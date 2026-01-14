import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-leadsig-api-key",
};

interface StatusPayload {
  status: string;
}

const VALID_STATUSES = ["new", "contacted", "qualified", "scheduled", "in_progress", "won", "lost"];

Deno.serve(async (req) => {
  console.log("leads-status: Request received", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "PATCH") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const apiKey = req.headers.get("x-leadsig-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-leadsig-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Verify API key
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("user_id, is_active")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !apiKeyRecord || !apiKeyRecord.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    // Extract lead ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const leadId = pathParts[pathParts.length - 1];

    if (!leadId || leadId === "leads-status") {
      return new Response(
        JSON.stringify({ error: "Lead ID is required in path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, status")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: StatusPayload = await req.json();
    console.log("leads-status: Payload", JSON.stringify(payload));

    if (!payload.status) {
      return new Response(
        JSON.stringify({ error: "Status is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_STATUSES.includes(payload.status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const previousStatus = lead.status;

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({ status: payload.status })
      .eq("id", leadId)
      .select()
      .single();

    if (updateError) {
      console.error("leads-status: Update error", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update status", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log status change interaction
    await supabase.from("interactions").insert({
      lead_id: leadId,
      type: "status_change",
      direction: "na",
      summary: `Status changed from ${previousStatus} to ${payload.status}`,
      metadata: { previous_status: previousStatus, new_status: payload.status, via: "api" },
    });

    console.log("leads-status: Updated lead", leadId, "to", payload.status);

    return new Response(
      JSON.stringify({ success: true, lead: updatedLead }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("leads-status: Error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
