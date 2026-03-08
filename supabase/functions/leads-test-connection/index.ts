import { createClient } from "npm:@supabase/supabase-js@2";

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

const RELEVANCE_AI_STUDIO_ID = "d50e7c9d-7933-47c5-b284-9295b3faf020";
const RELEVANCE_AI_PROJECT_ID = "a8f61433-8567-40b3-a274-8c65d6d9a062";

async function parseLeadWithAI(rawPayload: unknown): Promise<ParsedLead> {
  const apiKey = Deno.env.get("RELEVANCE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("RELEVANCE_AI_API_KEY not configured");
  }

  const endpoint = `https://api-bcbe5a.stack.tryrelevance.com/latest/studios/${RELEVANCE_AI_STUDIO_ID}/trigger_webhook?project=${RELEVANCE_AI_PROJECT_ID}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({ lead_data: rawPayload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.answer) {
      try {
        return JSON.parse(result.answer);
      } catch {
        throw new Error("AI returned invalid JSON format");
      }
    }

    return result.output || result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Relevance AI API timeout after 45 seconds");
    }
    throw error;
  }
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
    console.error("leads-test-connection: AI parsing failed, using fallback", aiError);
  }

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
      status: "new",
      created_by: userId,
      account_id: accountId,
      approval_status: "pending",
      submitted_at: new Date().toISOString(),
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
      summary: `Test lead created for ${platformNames[platform] || platform} connection verification`,
      metadata: { test: true, platform, parsing_method: parsingMethod },
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
