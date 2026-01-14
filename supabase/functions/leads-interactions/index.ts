import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-leadsig-api-key",
};

interface InteractionPayload {
  type: "call" | "text" | "note" | "status_change" | "booking" | "system";
  direction?: "inbound" | "outbound" | "na";
  summary?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  console.log("leads-interactions: Request received", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    if (!leadId || leadId === "leads-interactions") {
      return new Response(
        JSON.stringify({ error: "Lead ID is required in path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: InteractionPayload = await req.json();
    console.log("leads-interactions: Payload", JSON.stringify(payload));

    if (!payload.type) {
      return new Response(
        JSON.stringify({ error: "Interaction type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["call", "text", "note", "status_change", "booking", "system"];
    if (!validTypes.includes(payload.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create interaction
    const { data: interaction, error: insertError } = await supabase
      .from("interactions")
      .insert({
        lead_id: leadId,
        type: payload.type,
        direction: payload.direction || "na",
        summary: payload.summary,
        body: payload.body,
        metadata: payload.metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("leads-interactions: Insert error", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create interaction", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("leads-interactions: Created interaction", interaction.id);

    return new Response(
      JSON.stringify({ success: true, interaction }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("leads-interactions: Error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
