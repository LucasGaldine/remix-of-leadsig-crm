import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestConnectionPayload {
  platform: string;
  userId: string;
}

Deno.serve(async (req) => {
  console.log("leads-test-connection: Request received", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: TestConnectionPayload = await req.json();
    console.log("leads-test-connection: Payload received", JSON.stringify(payload));

    const { platform, userId } = payload;

    if (!platform || !userId) {
      return new Response(
        JSON.stringify({ error: "Platform and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the connection exists
    const { data: connection, error: connError } = await supabase
      .from("lead_source_connections")
      .select("id, status")
      .eq("user_id", userId)
      .eq("platform", platform)
      .single();

    if (connError || !connection) {
      console.log("leads-test-connection: Connection not found");
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a test lead
    const platformNames: Record<string, string> = {
      facebook: "Facebook",
      google: "Google",
      angi: "Angi",
      yelp: "Yelp",
      thumbtack: "Thumbtack",
    };

    const testLead = {
      name: `Test Lead - ${platformNames[platform] || platform}`,
      phone: "555-TEST-0000",
      email: `test.${platform}@leadsig.test`,
      service_type: "Test Connection",
      city: "Test City",
      source: platform,
      external_source_id: `test_${Date.now()}`,
      external_payload: { test: true, platform, timestamp: new Date().toISOString() },
      status: "new",
      created_by: userId,
      approval_status: "approved", // Auto-approve test leads
      submitted_at: new Date().toISOString(),
    };

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(testLead)
      .select()
      .single();

    if (leadError) {
      console.error("leads-test-connection: Failed to create test lead", leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create test lead", details: leadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log a system interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "system",
      direction: "na",
      summary: `Test lead created for ${platformNames[platform] || platform} connection verification`,
      metadata: { test: true, platform },
    });

    console.log("leads-test-connection: Test lead created successfully", lead.id);

    // Update last_sync_at on the connection
    await supabase
      .from("lead_source_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({ success: true, leadId: lead.id }),
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
