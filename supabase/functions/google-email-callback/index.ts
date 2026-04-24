import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data;
}

async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.email || "";
}

function settingsRedirect(appUrl: string, status: "connected" | "error", message?: string) {
  const url = new URL("/settings/auto-responses", appUrl);
  url.searchParams.set("google_email", status);
  if (message) url.searchParams.set("message", message);
  return Response.redirect(url.toString());
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/google-email-callback`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  let appUrl = "";
  let accountId = "";
  let userId = "";
  let nonce = "";

  try {
    const decoded = JSON.parse(atob(stateRaw || ""));
    appUrl = decoded.appUrl || "";
    accountId = decoded.accountId || "";
    userId = decoded.userId || "";
    nonce = decoded.nonce || "";
  } catch {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  if (oauthError) {
    return settingsRedirect(appUrl, "error", oauthError);
  }

  if (!appUrl) {
    return new Response("Missing app URL", { status: 400 });
  }

  if (!code || !accountId || !userId || !nonce) {
    return settingsRedirect(appUrl, "error", "Missing required OAuth parameters");
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: connection, error: connectionError } = await supabase
      .from("account_email_connections")
      .select("*")
      .eq("account_id", accountId)
      .eq("provider", "google")
      .maybeSingle();
    if (connectionError) throw connectionError;

    if (!connection || connection.oauth_nonce !== nonce || connection.connected_by_user_id !== userId) {
      return settingsRedirect(appUrl, "error", "Invalid OAuth state - please try connecting again");
    }

    const nonceAge = connection.oauth_nonce_created_at
      ? Date.now() - new Date(connection.oauth_nonce_created_at as string).getTime()
      : Infinity;
    if (nonceAge > 10 * 60 * 1000) {
      return settingsRedirect(appUrl, "error", "OAuth session expired - please try connecting again");
    }

    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    const email = await getUserEmail(tokens.access_token);
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshToken = tokens.refresh_token || (connection.refresh_token as string | undefined);

    if (!refreshToken) {
      return settingsRedirect(appUrl, "error", "Google did not return a refresh token - please try connecting again");
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("account_email_connections")
      .update({
        connected_email: email,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry,
        connected_by_user_id: userId,
        oauth_nonce: null,
        oauth_nonce_created_at: null,
        connected_at: now,
        updated_at: now,
      })
      .eq("account_id", accountId)
      .eq("provider", "google");
    if (updateError) throw updateError;

    return settingsRedirect(appUrl, "connected");
  } catch (error) {
    console.error("google-email-callback error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return settingsRedirect(appUrl, "error", message);
  }
});
