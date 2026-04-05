import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildIntegrationLeadStatus,
  evaluateAutoQualifyWebhook,
  getIntegrationAutomationSettings,
} from "../_shared/integration-lead-automation.ts";
import {
  isRelevanceAiTimeoutError,
  parseLeadWithRelevanceAi,
} from "../_shared/relevance-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestConnectionPayload {
  platform: string;
  userId: string;
  accountId: string;
}

interface ParsedLead {
  full_name?: string;
  email?: string;
  phone_number?: string;
  budget?: number;
  service_type?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  google: "Google",
  angi: "Angi",
  yelp: "Yelp",
  thumbtack: "Thumbtack",
};

async function parseLeadWithAI(rawPayload: unknown): Promise<ParsedLead> {
  const apiKey = Deno.env.get("RELEVANCE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("RELEVANCE_AI_API_KEY not configured");
  }

  const { data } = await parseLeadWithRelevanceAi<ParsedLead>(rawPayload, apiKey);
  return data;
}

function buildTestPayload(platform: string): Record<string, unknown> {
  const timestamp = new Date().toISOString();

  if (platform === "facebook") {
    return {
      field_data: [
        { name: "full_name", values: ["Test Lead - Facebook"] },
        { name: "email", values: ["test.facebook@leadsig.test"] },
        { name: "phone_number", values: ["555-TEST-0000"] },
        { name: "city", values: ["Test City"] },
        { name: "state", values: ["CA"] },
        { name: "what_service_are_you_interested_in", values: ["Test Connection"] },
      ],
      form_id: "test_form",
      leadgen_id: `test_${Date.now()}`,
      test: true,
      timestamp,
    };
  }

  if (platform === "google") {
    return {
      user_column_data: [
        { column_id: "FULL_NAME", column_name: "Full Name", string_value: "Test Lead - Google" },
        { column_id: "EMAIL", column_name: "Email", string_value: "test.google@leadsig.test" },
        { column_id: "PHONE_NUMBER", column_name: "Phone Number", string_value: "555-TEST-0000" },
        { column_id: "CITY", column_name: "City", string_value: "Test City" },
        { column_id: "STATE", column_name: "State", string_value: "CA" },
        { column_id: "COMPANY_NAME", column_name: "Service Type", string_value: "Test Connection" },
      ],
      lead_id: `test_${Date.now()}`,
      test: true,
      timestamp,
    };
  }

  return {
    name: `Test Lead - ${platformNames[platform] || platform}`,
    email: `test.${platform}@leadsig.test`,
    phone: "555-TEST-0000",
    city: "Test City",
    state: "CA",
    service_type: "Test Connection",
    test: true,
    timestamp,
  };
}

async function processTestLeadInBackground(
  platform: string,
  userId: string,
  accountId: string,
  connectionId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const testPayload = buildTestPayload(platform);
  const automationSettings = await getIntegrationAutomationSettings(supabase, accountId);
  const autoQualify = automationSettings.autoQualifyEnabled;

  let leadName = `Test Lead - ${platformNames[platform] || platform}`;
  let leadEmail: string | null = `test.${platform}@leadsig.test`;
  let leadPhone: string | null = "555-TEST-0000";
  let leadCity: string | null = "Test City";
  let leadState: string | null = "CA";
  let leadAddress: string | null = null;
  let leadServiceType: string | null = "Test Connection";
  let leadNotes: string | null = null;
  let leadBudget: number | null = null;
  let parsingMethod = "fallback";
  let aiTimeoutFallback = false;

  try {
    console.log("leads-test-connection: Sending test lead to Relevance AI");
    const aiParsed = await parseLeadWithAI(testPayload);
    console.log("leads-test-connection: Relevance AI response received", aiParsed);
    leadName = aiParsed.full_name || leadName;
    leadEmail = aiParsed.email || leadEmail;
    leadPhone = aiParsed.phone_number || leadPhone;
    leadCity = aiParsed.city || leadCity;
    leadState = aiParsed.state || leadState;
    leadAddress = aiParsed.address || leadAddress;
    leadServiceType = aiParsed.service_type || leadServiceType;
    leadNotes = aiParsed.notes || leadNotes;
    leadBudget = aiParsed.budget || leadBudget;
    parsingMethod = "ai";
  } catch (aiError) {
    aiTimeoutFallback = isRelevanceAiTimeoutError(aiError);
    if (aiTimeoutFallback) {
      console.warn("leads-test-connection: Auto-Qualify endpoint timed out, using fallback test lead values", {
        platform,
        accountId,
      });
    }
    console.error("leads-test-connection: AI parsing failed, using fallback", aiError);
    parsingMethod = aiTimeoutFallback ? "fallback_timeout" : "fallback";
  }

  let qualificationDecision = {
    qualified: autoQualify,
    reason: autoQualify ? "Auto-qualify enabled" : "Auto-qualify disabled",
    metadata: { webhook_used: false },
  };

  if (autoQualify && automationSettings.webhookConfig) {
    qualificationDecision = await evaluateAutoQualifyWebhook({
      config: automationSettings.webhookConfig,
      accountId,
      source: platform,
      leadData: {
        full_name: leadName,
        email: leadEmail,
        phone_number: leadPhone,
        city: leadCity,
        state: leadState,
        address: leadAddress,
        service_type: leadServiceType,
        notes: leadNotes,
        budget: leadBudget,
      },
      rawPayload: testPayload,
    });
  }

  const leadStatus = buildIntegrationLeadStatus(qualificationDecision.qualified);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      name: leadName,
      phone: leadPhone,
      email: leadEmail,
      city: leadCity,
      state: leadState,
      address: leadAddress,
      service_type: leadServiceType,
      estimated_value: leadBudget,
      notes: leadNotes,
      source: platform,
      external_source_id: `test_${Date.now()}`,
      external_payload: testPayload,
      ...leadStatus,
      created_by: userId,
      account_id: accountId,
    })
    .select("id")
    .maybeSingle();

  if (leadError) {
    console.error("leads-test-connection: Failed to create lead", leadError);
    return;
  }

  if (lead) {
    await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "system",
        direction: "na",
        summary: autoQualify
          ? qualificationDecision.qualified
            ? `Test lead auto-qualified for ${platformNames[platform] || platform} connection verification`
            : `Test lead marked not qualified by endpoint for ${platformNames[platform] || platform} connection verification`
          : `Test lead created for ${platformNames[platform] || platform} connection verification`,
        metadata: {
          test: true,
          platform,
          parsing_method: parsingMethod,
          auto_qualify_endpoint_timeout: aiTimeoutFallback,
          auto_qualify_reason: qualificationDecision.reason,
          ...qualificationDecision.metadata,
        },
      });
  }

  await supabase
    .from("lead_source_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connectionId);

  console.log("leads-test-connection: Test lead created successfully", lead?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TestConnectionPayload = await req.json();
    const { platform, userId, accountId } = payload;

    if (!platform || !userId || !accountId) {
      return new Response(
        JSON.stringify({ error: "Platform, userId, and accountId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connection, error: connError } = await supabase
      .from("lead_source_connections")
      .select("id, status")
      .eq("account_id", accountId)
      .eq("platform", platform)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Connection not found. Please connect this platform first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    EdgeRuntime.waitUntil(
      processTestLeadInBackground(
        platform,
        userId,
        accountId,
        connection.id,
        supabaseUrl,
        supabaseServiceKey
      ).catch((error) => console.error("leads-test-connection: Background processing error", error))
    );

    return new Response(
      JSON.stringify({ success: true, message: "Test lead is being processed through AI agent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("leads-test-connection: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
