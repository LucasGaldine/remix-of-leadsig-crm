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
    return null;
  }
  return data.access_token || null;
}

async function getUserPages(
  userToken: string,
  fbUserId: string
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const url = `${FB_GRAPH_BASE}/${fbUserId}/accounts?access_token=${userToken}&fields=id,name,access_token&limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    return [];
  }
  return data.data || [];
}

async function getPagesByIds(
  pageIds: string[],
  userToken: string
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const pages: Array<{ id: string; name: string; access_token: string }> = [];
  for (const pageId of pageIds) {
    const url = `${FB_GRAPH_BASE}/${pageId}?fields=id,name,access_token&access_token=${userToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      continue;
    }
    if (data.id && data.access_token) {
      pages.push({ id: data.id, name: data.name || `Page ${data.id}`, access_token: data.access_token });
    }
  }
  return pages;
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

async function getTokenDebugInfo(
  token: string,
  appId: string,
  appSecret: string
): Promise<Record<string, unknown>> {
  const url = `${FB_GRAPH_BASE}/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data || data;
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

    if (body.listPages) {
      return await handleListPages(supabase, user.id, body, appId, appSecret);
    }

    return await handleConnect(supabase, user.id, body, appId, appSecret);
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

async function handleListPages(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: { accessToken: string; fbUserId: string; nonce: string; accountId: string },
  appId: string,
  appSecret: string
) {
  const { accessToken, nonce, fbUserId } = body;

  if (!accessToken || !nonce || !fbUserId) {
    return new Response(
      JSON.stringify({ error: "accessToken, fbUserId, and nonce are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: connection } = await supabase
    .from("lead_source_connections")
    .select("id, settings_json")
    .eq("user_id", userId)
    .eq("platform", "facebook")
    .maybeSingle();

  if (
    !connection ||
    (connection.settings_json as Record<string, string>)?.oauth_nonce !== nonce
  ) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired OAuth state" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const debugInfo = await getTokenDebugInfo(accessToken, appId, appSecret);
  let pages = await getUserPages(accessToken, fbUserId);

  let longLivedToken: string | null = null;

  if (pages.length === 0) {
    longLivedToken = await getLongLivedUserToken(accessToken, appId, appSecret);

    pages = await getUserPages(longLivedToken, fbUserId);

    if (pages.length > 0) {
      await supabase
        .from("lead_source_connections")
        .update({
          settings_json: {
            oauth_nonce: nonce,
            user_access_token: longLivedToken,
          },
        })
        .eq("id", connection.id);
    }
  }

  if (pages.length === 0) {
    const granularScopes = (debugInfo as Record<string, unknown>)?.granular_scopes as
      Array<{ scope: string; target_ids?: string[] }> | undefined;
    const pageIds = granularScopes
      ?.find((s) => s.scope === "pages_show_list")
      ?.target_ids || [];
    if (pageIds.length > 0) {
      const tokenToUse = longLivedToken || accessToken;
      pages = await getPagesByIds(pageIds, tokenToUse);

      if (pages.length > 0 && longLivedToken) {
        await supabase
          .from("lead_source_connections")
          .update({
            settings_json: {
              oauth_nonce: nonce,
              user_access_token: longLivedToken,
            },
          })
          .eq("id", connection.id);
      }
    }
  }

  if (pages.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No Facebook Pages found. Your token has these scopes: " +
          JSON.stringify((debugInfo as Record<string, unknown>)?.scopes || []) +
          ". FB User ID: " + fbUserId +
          ". Please ensure you have admin access to a Facebook Page and that you selected pages to share during Facebook login.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      pages: pages.map((p) => ({ id: p.id, name: p.name, access_token: p.access_token })),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleConnect(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: {
    accessToken: string;
    fbUserId?: string;
    nonce: string;
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    accountId: string;
  },
  appId: string,
  appSecret: string
) {
  const { accessToken, nonce, pageId, pageName, pageAccessToken, accountId, fbUserId } = body;

  if (!accessToken || !nonce || !pageId || !pageName || !pageAccessToken || !accountId) {
    return new Response(
      JSON.stringify({ error: "accessToken, nonce, pageId, pageName, pageAccessToken, and accountId are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: connection } = await supabase
    .from("lead_source_connections")
    .select("id, settings_json")
    .eq("user_id", userId)
    .eq("platform", "facebook")
    .maybeSingle();

  if (
    !connection ||
    (connection.settings_json as Record<string, string>)?.oauth_nonce !== nonce
  ) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired OAuth state" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const settings = connection.settings_json as Record<string, string> | null;
  let longLivedToken = settings?.user_access_token || null;

  if (!longLivedToken) {
    longLivedToken = await getLongLivedUserToken(accessToken, appId, appSecret);
  }

  let finalPageToken: string | null = null;
  let tokenSource = "";

  const serverPageToken = await getPageTokenFromUser(pageId, longLivedToken);
  if (serverPageToken) {
    const valid = await validatePageToken(pageId, serverPageToken);
    if (valid) {
      finalPageToken = serverPageToken;
      tokenSource = "server_long_lived";
    }
  }

  if (!finalPageToken && fbUserId) {
    const pages = await getUserPages(longLivedToken, fbUserId);
    const match = pages.find((p) => p.id === pageId);
    if (match?.access_token) {
      const valid = await validatePageToken(pageId, match.access_token);
      if (valid) {
        finalPageToken = match.access_token;
        tokenSource = "server_user_pages";
      }
    }
  }

  if (!finalPageToken) {
    const valid = await validatePageToken(pageId, pageAccessToken);
    if (valid) {
      finalPageToken = pageAccessToken;
      tokenSource = "client_provided";
    }
  }

  if (!finalPageToken) {
    return new Response(
      JSON.stringify({
        error: "Could not obtain a valid page access token. Please ensure you have admin access to this Facebook Page.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await subscribePage(pageId, finalPageToken);

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
    return new Response(
      JSON.stringify({ error: "Failed to save connection: " + updateError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
