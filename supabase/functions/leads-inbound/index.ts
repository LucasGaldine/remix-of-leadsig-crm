import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-leadsig-api-key",
};

// Zapier-friendly payload structure
interface InboundLeadPayload {
  // Required
  source: string; // facebook | google | angi | yelp | thumbtack | custom

  // Lead info
  name?: string;
  phone?: string;
  email?: string;
  serviceType?: string;
  budget?: number;
  location?: string;
  address?: string;
  message?: string;

  // External reference
  externalLeadId?: string; // Alias for externalSourceId
  externalSourceId?: string;

  // Raw data passthrough
  raw?: Record<string, unknown>;
  externalPayload?: Record<string, unknown>; // Legacy support
}

// Google Ads webhook format
interface GoogleAdsWebhookPayload {
  lead_id: string;
  form_id: string;
  campaign_id?: string;
  adgroup_id?: string;
  creative_id?: string;
  google_key?: string;
  gcl_id?: string;
  api_version?: string;
  is_test?: boolean;
  create_time?: string;
  user_column_data: Array<{
    column_name?: string;
    column_id?: string;
    string_value?: string;
    boolean_value?: boolean;
  }>;
}

// Helper function to parse Google Ads webhook
function parseGoogleAdsWebhook(payload: GoogleAdsWebhookPayload): InboundLeadPayload {
  const leadData: InboundLeadPayload = {
    source: "google",
    externalSourceId: payload.lead_id,
    raw: payload as unknown as Record<string, unknown>,
  };

  // Parse user_column_data using column_id (standardized field names)
  for (const column of payload.user_column_data) {
    const columnId = (column.column_id || column.column_name || "").toUpperCase();
    const value = column.string_value || String(column.boolean_value || "");

    if (!value) continue;

    switch (columnId) {
      case "EMAIL":
        leadData.email = value;
        break;
      case "PHONE_NUMBER":
      case "PHONE":
        leadData.phone = value;
        break;
      case "FULL_NAME":
      case "FIRST_NAME":
      case "NAME":
        leadData.name = value;
        break;
      case "LAST_NAME":
        if (leadData.name) {
          leadData.name = `${leadData.name} ${value}`;
        } else {
          leadData.name = value;
        }
        break;
      case "CITY":
      case "LOCATION":
        leadData.location = value;
        break;
      case "REGION":
      case "STATE":
        if (leadData.location) {
          leadData.location = `${leadData.location}, ${value}`;
        } else {
          leadData.location = value;
        }
        break;
      case "ADDRESS":
      case "STREET_ADDRESS":
        leadData.address = value;
        break;
      case "ZIP_CODE":
      case "POSTAL_CODE":
        if (leadData.location) {
          leadData.location = `${leadData.location}, ${value}`;
        } else {
          leadData.location = value;
        }
        break;
      case "MESSAGE":
      case "COMMENTS":
      case "DESCRIPTION":
        leadData.message = value;
        break;
      case "SERVICE_TYPE":
      case "SERVICE":
        leadData.serviceType = value;
        break;
      case "BUDGET":
        leadData.budget = parseFloat(value) || undefined;
        break;
      default:
        // Store custom form fields in the message
        if (column.column_id && !column.column_id.match(/^[A-Z_]+$/)) {
          const customFieldText = `${column.column_id}: ${value}`;
          leadData.message = leadData.message
            ? `${leadData.message}\n${customFieldText}`
            : customFieldText;
        }
        break;
    }
  }

  return leadData;
}

// Helper to detect if payload is Google Ads format
function isGoogleAdsWebhook(payload: unknown): payload is GoogleAdsWebhookPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "user_column_data" in payload &&
    Array.isArray((payload as GoogleAdsWebhookPayload).user_column_data)
  );
}

Deno.serve(async (req) => {
  console.log("leads-inbound: Request received", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log all headers for debugging (helps identify Google's header names)
    console.log("leads-inbound: Request headers", Object.fromEntries(req.headers.entries()));

    // Parse request body first to check for Google Ads webhook
    const rawPayload = await req.json();
    console.log("leads-inbound: Raw payload received", JSON.stringify(rawPayload));

    // Validate API key - check multiple possible locations
    let apiKey: string | null = null;

    // Check if this is a Google Ads webhook (has google_key in body)
    if (isGoogleAdsWebhook(rawPayload) && rawPayload.google_key) {
      apiKey = rawPayload.google_key;
      console.log("leads-inbound: Using google_key from webhook payload");
    } else {
      // Check common Google header names first, then custom headers
      apiKey =
        req.headers.get("x-goog-webhook-key") ||
        req.headers.get("x-goog-api-key") ||
        req.headers.get("google-ads-webhook-key") ||
        req.headers.get("x-google-api-key") ||
        req.headers.get("authorization")?.replace("Bearer ", "") ||
        req.headers.get("x-leadsig-api-key");

      if (!apiKey) {
        // Check query parameters
        const url = new URL(req.url);
        apiKey = url.searchParams.get("key") || url.searchParams.get("api_key");
      }

      if (apiKey) {
        console.log("leads-inbound: API key found in headers or query params");
      }
    }

    if (!apiKey) {
      console.log("leads-inbound: Missing API key");
      return new Response(
        JSON.stringify({ error: "Missing API key. Provide via google_key in body, headers (x-goog-webhook-key, x-goog-api-key, authorization, x-leadsig-api-key), or 'key' query parameter" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the API key to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Look up the API key
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("user_id, account_id, is_active")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !apiKeyRecord) {
      console.log("leads-inbound: Invalid API key", keyError);
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyRecord.is_active) {
      console.log("leads-inbound: API key is inactive");
      return new Response(
        JSON.stringify({ error: "API key is inactive" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyRecord.account_id) {
      console.log("leads-inbound: API key has no account_id");
      return new Response(
        JSON.stringify({ error: "API key is not associated with an account" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = apiKeyRecord.user_id;
    const accountId = apiKeyRecord.account_id;

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    // Process the payload (already parsed above)
    let payload: InboundLeadPayload;
    if (isGoogleAdsWebhook(rawPayload)) {
      console.log("leads-inbound: Detected Google Ads webhook format");
      payload = parseGoogleAdsWebhook(rawPayload);
      console.log("leads-inbound: Parsed payload", JSON.stringify(payload));
    } else {
      // Standard format
      payload = rawPayload as InboundLeadPayload;
    }

    // Validate required fields
    if (!payload.name && !payload.phone && !payload.email) {
      return new Response(
        JSON.stringify({ error: "At least one of name, phone, or email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.source) {
      return new Response(
        JSON.stringify({ error: "Source is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize external ID (support both naming conventions)
    const externalId = payload.externalLeadId || payload.externalSourceId;

    // Normalize external payload (support both naming conventions)
    const externalPayload = payload.raw || payload.externalPayload || {};

    // Create notes from message + raw payload if provided
    let leadNotes = "";
    if (payload.message) {
      leadNotes = payload.message;
    }

    // Create the lead - inbound leads default to pending approval
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: payload.name || "Unknown",
        phone: payload.phone,
        email: payload.email,
        service_type: payload.serviceType,
        estimated_budget: payload.budget,
        city: payload.location,
        address: payload.address,
        source: payload.source,
        external_source_id: externalId,
        external_payload: externalPayload,
        notes: leadNotes || null,
        status: "new",
        created_by: userId,
        account_id: accountId,
        approval_status: "pending", // Inbound leads require approval
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leadError) {
      console.error("leads-inbound: Failed to create lead", leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: leadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log a system interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "system",
      direction: "na",
      summary: `Lead created via API from ${payload.source}`,
      metadata: { source: payload.source, externalSourceId: payload.externalSourceId },
    });

    console.log("leads-inbound: Lead created successfully", lead.id);

    return new Response(
      JSON.stringify({ success: true, lead }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("leads-inbound: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
