import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FB_GRAPH_VERSION = "v21.0";
const FB_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "leads_retrieval",
  "pages_manage_metadata",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId, redirectUri } = await req.json();

    console.log("Redirect URI being sent to Facebook:", redirectUri);

    
    if (!accountId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "accountId and redirectUri are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    if (!appId) {
      return new Response(
        JSON.stringify({ error: "Facebook integration is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nonce = crypto.randomUUID();
    const statePayload = JSON.stringify({
      userId: user.id,
      accountId,
      nonce,
    });
    const state = btoa(statePayload);

    await supabase.from("lead_source_connections").upsert(
      {
        user_id: user.id,
        account_id: accountId,
        platform: "facebook",
        status: "not_connected",
        connection_method: "oauth",
        settings_json: { oauth_nonce: nonce },
      },
      { onConflict: "user_id,platform" }
    );

    const oauthUrl =
      `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?` +
      new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        scope: FB_SCOPES,
        response_type: "code",
      }).toString();

    return new Response(JSON.stringify({ url: oauthUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("facebook-oauth-connect error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
