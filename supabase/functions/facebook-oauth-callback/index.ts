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

async function validatePageToken(
  pageId: string,
  pageToken: string
): Promise<boolean> {
  const url = `${FB_GRAPH_BASE}/${pageId}?fields=id&access_token=${pageToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.log("validatePageToken error:", JSON.stringify(data.error));
    return false;
  }
  return data.id === pageId;
}

async function getPageTokenFromUser(
  pageId: string,
  userToken: string
): Promise<string | null> {
  const url = `${FB_GRAPH_BASE}/${pageId}?fields=access_token&access_token=${userToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.log("getPageTokenFromUser error:", JSON.stringify(data.error));
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
  console.log("subscribePage response:", JSON.stringify(data));
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

    console.log("Exchanging for long-lived user token...");
    const longLivedToken = await getLongLivedUserToken(accessToken, appId, appSecret);
    console.log("Got long-lived user token");

    let finalPageToken: string | null = null;
    let tokenSource = "";

    const serverPageToken = await getPageTokenFromUser(pageId, longLivedToken);
    if (serverPageToken) {
      const valid = await validatePageToken(pageId, serverPageToken);
      if (valid) {
        finalPageToken = serverPageToken;
        tokenSource = "server_long_lived";
        console.log("Using long-lived page token from server");
      }
    }

    if (!finalPageToken) {
      const pages = await getUserPages(longLivedToken);
      const match = pages.find((p) => p.id === pageId);
      if (match?.access_token) {
        const valid = await validatePageToken(pageId, match.access_token);
        if (valid) {
          finalPageToken = match.access_token;
          tokenSource = "server_user_pages";
          console.log("Using page token from /me/accounts");
        }
      }
    }

    if (!finalPageToken) {
      console.log("Server-side methods failed, validating client-provided page token...");
      const valid = await validatePageToken(pageId, pageAccessToken);
      if (valid) {
        finalPageToken = pageAccessToken;
        tokenSource = "client_provided";
        console.log("Client-provided page token is valid");
      }
    }

    if (!finalPageToken) {
      return new Response(
        JSON.stringify({
          error: "Could not obtain a valid page access token. Please ensure you have admin access to this Facebook Page.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Subscribing page ${pageId} to leadgen (token source: ${tokenSource})...`);
    await subscribePage(pageId, finalPageToken);
    console.log("Page subscribed successfully");

    const { error: updateError } = await supabase
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
          user_access_token: longLivedToken,
          token_source: tokenSource,
        },
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error("DB update error:", JSON.stringify(updateError));
      return new Response(
        JSON.stringify({ error: "Failed to save connection: " + updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Connection saved successfully");

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
