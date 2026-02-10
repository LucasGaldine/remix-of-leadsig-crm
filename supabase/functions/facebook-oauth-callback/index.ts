import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FB_GRAPH_VERSION = "v21.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

async function getLongLivedUserToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const url =
    `${FB_GRAPH_BASE}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    }).toString();

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to get long-lived token");
  }
  return data.access_token;
}

async function getPageToken(
  pageId: string,
  userToken: string
): Promise<string | null> {
  const url = `${FB_GRAPH_BASE}/${pageId}?fields=access_token&access_token=${userToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.log("getPageToken error:", JSON.stringify(data.error));
    return null;
  }
  return data.access_token || null;
}

async function getUserPages(
  userToken: string
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const url = `${FB_GRAPH_BASE}/me/accounts?access_token=${userToken}&fields=id,name,access_token&limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.log("getUserPages error:", JSON.stringify(data.error));
    return [];
  }
  return data.data || [];
}

async function subscribePage(pageId: string, pageToken: string): Promise<void> {
  const url = `${FB_GRAPH_BASE}/${pageId}/subscribed_apps`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: "leadgen",
      access_token: pageToken,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(
      data.error.message || "Failed to subscribe page to leadgen"
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ error: "Facebook integration is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const body = await req.json();
    const { accessToken, nonce, pageId, pageName, pageAccessToken, accountId } = body;

    if (!accessToken || !nonce || !pageId || !pageName || !pageAccessToken || !accountId) {
      return new Response(
        JSON.stringify({ error: "accessToken, nonce, pageId, pageName, pageAccessToken, and accountId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: connection } = await supabase
      .from("lead_source_connections")
      .select("id, settings_json")
      .eq("user_id", user.id)
      .eq("platform", "facebook")
      .maybeSingle();

    if (
      !connection ||
      (connection.settings_json as Record<string, string>)?.oauth_nonce !== nonce
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OAuth state" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const longLivedToken = await getLongLivedUserToken(accessToken, appId, appSecret);

    let finalPageToken: string | null = null;

    finalPageToken = await getPageToken(pageId, longLivedToken);

    if (!finalPageToken) {
      const pages = await getUserPages(longLivedToken);
      const match = pages.find((p) => p.id === pageId);
      finalPageToken = match?.access_token || null;
    }

    if (!finalPageToken) {
      console.log("Using client-provided page token as fallback");
      finalPageToken = pageAccessToken;
    }

    await subscribePage(pageId, finalPageToken);

    await supabase
      .from("lead_source_connections")
      .update({
        status: "connected",
        connected_at: new Date().toISOString(),
        connection_method: "oauth",
        account_id: accountId,
        settings_json: {
          page_id: pageId,
          page_name: pageName,
          page_access_token: finalPageToken,
        },
      })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("facebook-oauth-callback error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
