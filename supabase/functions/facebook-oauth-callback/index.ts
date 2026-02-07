import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FB_GRAPH_VERSION = "v21.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; token_type: string }> {
  const url =
    `${FB_GRAPH_BASE}/oauth/access_token?` +
    new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }).toString();

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to exchange code");
  }
  return data;
}

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

async function getUserPages(
  userToken: string
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const url = `${FB_GRAPH_BASE}/me/accounts?access_token=${userToken}&fields=id,name,access_token`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to get pages");
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

    if (body.action === "select_page") {
      return await handlePageSelection(supabase, user.id, body);
    }

    return await handleCodeExchange(supabase, user.id, body, appId, appSecret);
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

async function handleCodeExchange(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: { code: string; state: string; redirectUri: string },
  appId: string,
  appSecret: string
) {
  const { code, state, redirectUri } = body;
  if (!code || !state || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "code, state, and redirectUri are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let stateData: { userId: string; accountId: string; nonce: string };
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (stateData.userId !== userId) {
    return new Response(JSON.stringify({ error: "State mismatch" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: connection } = await supabase
    .from("lead_source_connections")
    .select("id, settings_json")
    .eq("user_id", userId)
    .eq("platform", "facebook")
    .maybeSingle();

  if (
    !connection ||
    (connection.settings_json as Record<string, string>)?.oauth_nonce !==
      stateData.nonce
  ) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired OAuth state" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const tokenData = await exchangeCodeForToken(
    code,
    redirectUri,
    appId,
    appSecret
  );
  const longLivedToken = await getLongLivedUserToken(
    tokenData.access_token,
    appId,
    appSecret
  );
  const pages = await getUserPages(longLivedToken);

  await supabase
    .from("lead_source_connections")
    .update({
      settings_json: {
        user_access_token: longLivedToken,
        oauth_nonce: null,
      },
    })
    .eq("id", connection.id);

  return new Response(
    JSON.stringify({
      success: true,
      pages: pages.map((p) => ({ id: p.id, name: p.name })),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handlePageSelection(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: { action: string; pageId: string; pageName: string; accountId: string }
) {
  const { pageId, pageName, accountId } = body;
  if (!pageId || !pageName || !accountId) {
    return new Response(
      JSON.stringify({
        error: "pageId, pageName, and accountId are required",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: connection, error: connError } = await supabase
    .from("lead_source_connections")
    .select("id, settings_json")
    .eq("user_id", userId)
    .eq("platform", "facebook")
    .maybeSingle();

  if (connError || !connection) {
    return new Response(
      JSON.stringify({ error: "No Facebook connection found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const settings = connection.settings_json as Record<string, string>;
  const userToken = settings?.user_access_token;
  if (!userToken) {
    return new Response(
      JSON.stringify({
        error: "Missing access token. Please restart the connection process.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const pages = await getUserPages(userToken);
  const selectedPage = pages.find((p) => p.id === pageId);
  if (!selectedPage) {
    return new Response(
      JSON.stringify({
        error: "Page not found or you don't have access to it",
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  await subscribePage(pageId, selectedPage.access_token);

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
        page_access_token: selectedPage.access_token,
      },
    })
    .eq("id", connection.id);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
