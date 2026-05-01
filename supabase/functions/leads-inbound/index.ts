import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildIntegrationLeadStatus,
  evaluateIntegrationQualificationDecision,
  getIntegrationAutomationSettings,
} from "../_shared/integration-lead-automation.ts";
import {
  buildFallbackInteractionPayload,
  buildFallbackLeadInsertValues,
} from "../_shared/lead-ingestion-fallback.ts";
import {
  isRelevanceAiTimeoutError,
  parseLeadWithRelevanceAi,
} from "../_shared/relevance-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-leadsig-api-key",
};

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
  source?: string;
}

interface GoogleColumnData {
  column_id: string;
  string_value: string;
  column_name?: string;
}

function isWebsitePayload(rawPayload: Record<string, unknown>, detectedSource: string): boolean {
  if (detectedSource.trim().toLowerCase() === "website") return true;

  const explicitSource = typeof rawPayload.source === "string"
    ? rawPayload.source.trim().toLowerCase()
    : "";
  if (explicitSource === "website" || explicitSource === "website_form" || explicitSource === "site") {
    return true;
  }

  // Website lead forms usually include SMS consent-style fields plus basic contact fields.
  const hasSmsConsentField =
    typeof rawPayload.sms_consent === "boolean" ||
    typeof rawPayload.smsConsent === "boolean" ||
    typeof rawPayload.sms_opt_in === "boolean" ||
    typeof rawPayload.smsOptIn === "boolean";

  const hasBasicContactFields =
    typeof rawPayload.name === "string" ||
    typeof rawPayload.phone === "string" ||
    typeof rawPayload.email === "string";

  return hasSmsConsentField && hasBasicContactFields;
}

function parseGoogleLead(payload: Record<string, unknown>): ParsedLead | null {
  const columns = payload.user_column_data as GoogleColumnData[] | undefined;
  if (!Array.isArray(columns)) return null;

  const lead: ParsedLead = {};
  const nameParts: string[] = [];

  for (const col of columns) {
    const id = (col.column_id || "").toUpperCase();
    const name = (col.column_name || "").toLowerCase();
    const val = (col.string_value || "").trim();
    if (!val) continue;

    if (id === "FULL_NAME" || name.includes("full name")) {
      lead.full_name = val;
    } else if (id === "FIRST_NAME" || name.includes("first name")) {
      nameParts[0] = val;
    } else if (id === "LAST_NAME" || name.includes("last name")) {
      nameParts[1] = val;
    } else if (id === "EMAIL" || name.includes("email")) {
      lead.email = val;
    } else if (id === "PHONE_NUMBER" || name.includes("phone")) {
      lead.phone_number = val;
    } else if (id === "STREET_ADDRESS" || name.includes("address") || name.includes("street")) {
      lead.address = val;
    } else if (id === "CITY" || name === "city") {
      lead.city = val;
    } else if (id === "REGION" || id === "STATE" || name === "state" || name === "region") {
      lead.state = val;
    } else if (name.includes("budget") || name.includes("value") || name.includes("price")) {
      const cleaned = val.replace(/[$,]/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) lead.budget = parsed;
    } else if (name.includes("service") || name.includes("type") || id === "COMPANY_NAME") {
      lead.service_type = val;
    } else {
      lead.notes = lead.notes ? `${lead.notes}; ${col.column_name || col.column_id}: ${val}` : `${col.column_name || col.column_id}: ${val}`;
    }
  }

  if (!lead.full_name && nameParts.length > 0) {
    lead.full_name = nameParts.filter(Boolean).join(" ");
  }

  return lead;
}

function parseFacebookLead(payload: Record<string, unknown>): ParsedLead | null {
  const fieldData = payload.field_data as Array<{ name: string; values: string[] }> | undefined;
  if (!Array.isArray(fieldData)) return null;

  const lead: ParsedLead = {};
  const nameParts: string[] = [];

  for (const field of fieldData) {
    const name = (field.name || "").toLowerCase();
    const val = (field.values?.[0] || "").trim();
    if (!val) continue;

    if (name === "full_name" || name.includes("full name")) {
      lead.full_name = val;
    } else if (name === "first_name" || name.includes("first")) {
      nameParts[0] = val;
    } else if (name === "last_name" || name.includes("last")) {
      nameParts[1] = val;
    } else if (name.includes("email")) {
      lead.email = val;
    } else if (name.includes("phone")) {
      lead.phone_number = val;
    } else if (name.includes("city")) {
      lead.city = val;
    } else if (name.includes("state") || name.includes("region")) {
      lead.state = val;
    } else if (name.includes("address") || name.includes("street")) {
      lead.address = val;
    } else if (name.includes("budget") || name.includes("value")) {
      const cleaned = val.replace(/[$,]/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) lead.budget = parsed;
    } else {
      lead.notes = lead.notes ? `${lead.notes}; ${field.name}: ${val}` : `${field.name}: ${val}`;
    }
  }

  if (!lead.full_name && nameParts.length > 0) {
    lead.full_name = nameParts.filter(Boolean).join(" ");
  }

  return lead;
}

function parseGenericLead(payload: Record<string, unknown>): ParsedLead | null {
  const getString = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const val = payload[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return undefined;
  };

  const getNumber = (keys: string[]): number | undefined => {
    for (const key of keys) {
      const val = payload[key];
      if (typeof val === "number" && !isNaN(val)) return val;
      if (typeof val === "string") {
        const cleaned = val.replace(/[$,]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const name = getString(["name", "full_name", "fullName", "customer_name", "customerName", "contact_name", "contactName"]);
  const email = getString(["email", "email_address", "emailAddress", "customer_email"]);
  const phone = getString(["phone", "phone_number", "phoneNumber", "telephone", "mobile", "customer_phone"]);

  if (!name && !email && !phone) return null;

  const firstName = getString(["first_name", "firstName"]);
  const lastName = getString(["last_name", "lastName"]);
  const fullName = name || [firstName, lastName].filter(Boolean).join(" ") || undefined;

  const locationStr = getString(["location", "city_state"]);
  let city = getString(["city"]);
  let state = getString(["state", "region", "province"]);

  if (!city && !state && locationStr) {
    const parts = locationStr.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      city = parts[0];
      state = parts[1];
    } else {
      city = locationStr;
    }
  }

  const extraNotes: string[] = [];
  const knownKeys = new Set([
    "name", "full_name", "fullName", "customer_name", "customerName", "contact_name", "contactName",
    "email", "email_address", "emailAddress", "customer_email",
    "phone", "phone_number", "phoneNumber", "telephone", "mobile", "customer_phone",
    "first_name", "firstName", "last_name", "lastName",
    "location", "city_state", "city", "state", "region", "province",
    "address", "street", "street_address", "streetAddress",
    "service_type", "serviceType", "service", "category", "project_type", "projectType",
    "budget", "estimated_value", "estimatedValue", "value", "price", "amount",
    "message", "notes", "description", "details", "comment", "comments",
    "source", "google_key", "api_key",
  ]);

  for (const [key, val] of Object.entries(payload)) {
    if (knownKeys.has(key)) continue;
    if (val !== null && val !== undefined && typeof val !== "object") {
      extraNotes.push(`${key}: ${val}`);
    }
  }

  const messageStr = getString(["message", "notes", "description", "details", "comment", "comments"]);
  const allNotes = [messageStr, ...extraNotes].filter(Boolean).join("; ") || undefined;

  return {
    full_name: fullName,
    email,
    phone_number: phone,
    address: getString(["address", "street", "street_address", "streetAddress"]),
    city,
    state,
    service_type: getString(["service_type", "serviceType", "service", "category", "project_type", "projectType"]),
    budget: getNumber(["budget", "estimated_value", "estimatedValue", "value", "price", "amount"]),
    notes: allNotes,
    source: getString(["source"]),
  };
}

function detectSourceAndParse(rawPayload: Record<string, unknown>): { source: string; parsed: ParsedLead | null } {
  if ("user_column_data" in rawPayload && "lead_id" in rawPayload) {
    return { source: "google", parsed: parseGoogleLead(rawPayload) };
  }

  if ("field_data" in rawPayload || ("form_id" in rawPayload && "leadgen_id" in rawPayload)) {
    return { source: "facebook", parsed: parseFacebookLead(rawPayload) };
  }

  const genericParsed = parseGenericLead(rawPayload);
  if (genericParsed) {
    const source = genericParsed.source || "unknown";
    delete genericParsed.source;
    return { source, parsed: genericParsed };
  }

  return { source: "unknown", parsed: null };
}

async function parseLeadWithAI(rawPayload: unknown): Promise<ParsedLead> {
  const apiKey = Deno.env.get("RELEVANCE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("RELEVANCE_AI_API_KEY not configured");
  }

  const { data } = await parseLeadWithRelevanceAi<ParsedLead>(rawPayload, apiKey);
  return data;
}

async function processLeadInBackground(
  rawPayload: Record<string, unknown>,
  userId: string,
  accountId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const automationSettings = await getIntegrationAutomationSettings(supabase, accountId);
  const autoQualify = automationSettings.autoQualifyEnabled;

  const { source, parsed: directParsed } = detectSourceAndParse(rawPayload);
  console.log(`leads-inbound: Source detected as '${source}', direct parse result:`, directParsed ? "success" : "null");

  let leadData: ParsedLead | null = directParsed;
  let aiFallbackReason: "timeout" | "error" | null = null;

  if (!leadData) {
    try {
      leadData = await parseLeadWithAI(rawPayload);
    } catch (aiError) {
      aiFallbackReason = isRelevanceAiTimeoutError(aiError) ? "timeout" : "error";
      if (aiFallbackReason === "timeout") {
        console.warn("leads-inbound: Auto-Qualify endpoint timed out, inserting lead via fallback path", {
          accountId,
          source,
        });
      }
      console.error("leads-inbound: AI parsing failed", aiError);
    }
  }

  const qualificationDecision = await evaluateIntegrationQualificationDecision({
    automationSettings,
    accountId,
    source,
    leadData: (leadData ?? {}) as Record<string, unknown>,
    rawPayload,
  });
  const forcePendingUntilConversationComplete = isWebsitePayload(rawPayload, source);

  if (!leadData || (!leadData.full_name && !leadData.phone_number && !leadData.email)) {
    const leadStatus = forcePendingUntilConversationComplete
      ? buildIntegrationLeadStatus(false)
      : buildIntegrationLeadStatus(qualificationDecision.qualified);

    const { data: lead } = await supabase
      .from("leads")
      .insert(buildFallbackLeadInsertValues({
        leadData,
        source,
        rawPayload,
        leadStatus,
        userId,
        accountId,
      }))
      .select()
      .maybeSingle();

    if (lead) {
      await supabase.from("interactions").insert(
        buildFallbackInteractionPayload({
          leadId: lead.id,
          autoQualify: qualificationDecision.qualified,
          source,
          directParsed: Boolean(directParsed),
          aiFallbackReason,
        }),
      );
    }
    return;
  }

  const leadStatus = forcePendingUntilConversationComplete
    ? buildIntegrationLeadStatus(false)
    : buildIntegrationLeadStatus(qualificationDecision.qualified);
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      name: leadData.full_name || "Unknown",
      phone: leadData.phone_number || null,
      email: leadData.email || null,
      service_type: leadData.service_type || null,
      estimated_value: leadData.budget || null,
      city: leadData.city || null,
      state: leadData.state || null,
      address: leadData.address || null,
      source,
      external_payload: rawPayload,
      notes: leadData.notes || null,
      ...leadStatus,
      created_by: userId,
      account_id: accountId,
    })
    .select()
    .maybeSingle();

  if (leadError) {
    console.error("leads-inbound: Failed to create lead", leadError);
    return;
  }

  if (lead) {
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "system",
      direction: "na",
      summary: forcePendingUntilConversationComplete
        ? `Lead created via ${source} and added to pending review`
        : autoQualify
        ? qualificationDecision.qualified
          ? `Lead created via ${source} and auto-qualified`
          : `Lead created via ${source} and marked not qualified`
        : `Lead created via ${source} (parsed directly)`,
      metadata: {
        source,
        pending_until_conversation_complete: forcePendingUntilConversationComplete,
        parsing_method: directParsed ? "direct" : "ai",
        auto_qualify_reason: qualificationDecision.reason,
        ...qualificationDecision.metadata,
      },
    });
  }

  console.log("leads-inbound: Lead created successfully", lead?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawPayload = await req.json();
    console.log("leads-inbound: Payload received", JSON.stringify(rawPayload));

    let apiKey: string | null = null;

    if (typeof rawPayload === "object" && rawPayload !== null && "google_key" in rawPayload) {
      apiKey = String(rawPayload.google_key);
    } else {
      apiKey =
        req.headers.get("x-goog-webhook-key") ||
        req.headers.get("x-goog-api-key") ||
        req.headers.get("google-ads-webhook-key") ||
        req.headers.get("x-google-api-key") ||
        req.headers.get("authorization")?.replace("Bearer ", "") ||
        req.headers.get("x-leadsig-api-key");

      if (!apiKey) {
        const url = new URL(req.url);
        apiKey = url.searchParams.get("key") || url.searchParams.get("api_key");
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("user_id, account_id, is_active")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyError || !apiKeyRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyRecord.is_active) {
      return new Response(
        JSON.stringify({ error: "API key is inactive" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyRecord.account_id) {
      return new Response(
        JSON.stringify({ error: "API key is not associated with an account" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = apiKeyRecord.user_id;
    const accountId = apiKeyRecord.account_id;

    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    EdgeRuntime.waitUntil(
      processLeadInBackground(rawPayload, userId, accountId, supabaseUrl, supabaseServiceKey)
        .catch((error) => console.error("leads-inbound: Background processing error", error))
    );

    return new Response(
      JSON.stringify({ success: true, message: "Lead received and is being processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("leads-inbound: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
