import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-leadsig-api-key",
};

// Relevance AI Configuration
const RELEVANCE_AI_STUDIO_ID = "d50e7c9d-7933-47c5-b284-9295b3faf020";
const RELEVANCE_AI_PROJECT_ID = "a8f61433-8567-40b3-a274-8c65d6d9a062";

// Relevance AI Response Structure
interface RelevanceAIResponse {
  full_name?: string;
  email?: string;
  phone_number?: string;
  budget?: number;
  service_type?: string;
  address?: string;
  city?: string;
  notes?: string;
  is_budget_confirmed?: boolean;
  is_in_service_area?: boolean;
  is_decision_maker?: boolean;
}

// Call Relevance AI API to parse lead data
async function parseLeadWithAI(
  rawPayload: unknown,
  retryCount = 0
): Promise<RelevanceAIResponse> {
  const apiKey = Deno.env.get("RELEVANCE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("RELEVANCE_AI_API_KEY not configured");
  }

  const endpoint = `https://api-bcbe5a.stack.tryrelevance.com/latest/studios/${RELEVANCE_AI_STUDIO_ID}/trigger_webhook?project=${RELEVANCE_AI_PROJECT_ID}`;

  try {
    console.log("Calling Relevance AI API...", { retryCount });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({
        lead_data: rawPayload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Relevance AI API error:", response.status, errorText);
      throw new Error(`AI API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("Relevance AI response:", JSON.stringify(result));

    return result.output || result;
  } catch (error) {
    console.error("Relevance AI API call failed:", error);

    // Retry once on failure
    if (retryCount === 0) {
      console.log("Retrying Relevance AI API call...");
      return parseLeadWithAI(rawPayload, 1);
    }

    throw error;
  }
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

    // Log all headers for debugging
    console.log("leads-inbound: Request headers", Object.fromEntries(req.headers.entries()));

    // Parse request body
    const rawPayload = await req.json();
    console.log("leads-inbound: Raw payload received", JSON.stringify(rawPayload));

    // Validate API key - check multiple possible locations
    let apiKey: string | null = null;

    // Check if this is a Google Ads webhook with google_key in body
    if (typeof rawPayload === "object" && rawPayload !== null && "google_key" in rawPayload) {
      apiKey = String(rawPayload.google_key);
      console.log("leads-inbound: Using google_key from webhook payload");
    } else {
      // Check common header names
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

    // Parse the lead with AI
    let aiParsedData: RelevanceAIResponse;
    try {
      aiParsedData = await parseLeadWithAI(rawPayload);
    } catch (aiError) {
      console.error("leads-inbound: AI parsing failed after retry", aiError);

      // Create a minimal lead record with error note
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: "AI Processing Failed",
          phone: null,
          email: null,
          source: "unknown",
          external_payload: rawPayload,
          notes: "Lead processing failed - AI service unavailable. Please review raw payload.",
          status: "new",
          created_by: userId,
          account_id: accountId,
          approval_status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (leadError) {
        console.error("leads-inbound: Failed to create fallback lead", leadError);
        return new Response(
          JSON.stringify({
            error: "Failed to create lead",
            details: leadError.message
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (lead) {
        // Log error interaction
        await supabase.from("interactions").insert({
          lead_id: lead.id,
          type: "system",
          direction: "na",
          summary: "Lead processing failed - AI service unavailable",
          metadata: { error: String(aiError) },
        });
      }

      // Return 200 OK to webhook sender (Google) even though AI failed
      // The lead was still created for manual review
      return new Response(
        JSON.stringify({
          success: true,
          lead_id: lead?.id,
          warning: "AI processing unavailable - lead created for manual review"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that we got at least some identifying information
    if (!aiParsedData.full_name && !aiParsedData.phone_number && !aiParsedData.email) {
      console.error("leads-inbound: AI returned no identifying information");
      return new Response(
        JSON.stringify({ error: "Unable to extract identifying information from lead data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect source from payload structure
    let source = "unknown";
    if (typeof rawPayload === "object" && rawPayload !== null) {
      if ("user_column_data" in rawPayload && "lead_id" in rawPayload) {
        source = "google";
      } else if ("form_id" in rawPayload || "campaign_id" in rawPayload) {
        source = "facebook";
      }
    }

    // Create the lead record
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: aiParsedData.full_name || "Unknown",
        phone: aiParsedData.phone_number || null,
        email: aiParsedData.email || null,
        service_type: aiParsedData.service_type || null,
        estimated_budget: aiParsedData.budget || null,
        city: aiParsedData.city || null,
        address: aiParsedData.address || null,
        source: source,
        external_payload: rawPayload,
        notes: aiParsedData.notes || null,
        status: "new",
        created_by: userId,
        account_id: accountId,
        approval_status: "pending",
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

    // Calculate fit score based on AI qualifications
    let fitScore = 0;
    const qualifications = [
      aiParsedData.is_budget_confirmed,
      aiParsedData.is_in_service_area,
      aiParsedData.is_decision_maker,
    ];
    const confirmedCount = qualifications.filter(Boolean).length;
    fitScore = Math.round((confirmedCount / qualifications.length) * 100);

    // Create lead qualification record
    const { error: qualificationError } = await supabase
      .from("lead_qualifications")
      .insert({
        lead_id: lead.id,
        is_budget_confirmed: aiParsedData.is_budget_confirmed || false,
        is_in_service_area: aiParsedData.is_in_service_area || false,
        is_decision_maker: aiParsedData.is_decision_maker || false,
      });

    if (qualificationError) {
      console.error("leads-inbound: Failed to create qualification", qualificationError);
    }

    // Log a system interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "system",
      direction: "na",
      summary: `Lead created via API from ${source} (AI-parsed, fit score: ${fitScore}%)`,
      metadata: {
        source,
        ai_parsed: true,
        fit_score: fitScore,
        qualifications: {
          budget_confirmed: aiParsedData.is_budget_confirmed,
          in_service_area: aiParsedData.is_in_service_area,
          decision_maker: aiParsedData.is_decision_maker,
        }
      },
    });

    console.log("leads-inbound: Lead created successfully", lead.id);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        fit_score: fitScore
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("leads-inbound: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
