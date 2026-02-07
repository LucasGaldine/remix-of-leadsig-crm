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

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  google: "Google",
  angi: "Angi",
  yelp: "Yelp",
  thumbtack: "Thumbtack",
};

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
      account_id: accountId,
      approval_status: "approved",
      submitted_at: new Date().toISOString(),
    };

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(testLead)
      .select()
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Failed to create test lead", details: leadError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "system",
      direction: "na",
      summary: `Test lead created for ${platformNames[platform] || platform} connection verification`,
      metadata: { test: true, platform },
    });

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
