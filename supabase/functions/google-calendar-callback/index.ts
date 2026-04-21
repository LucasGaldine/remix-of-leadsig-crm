import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";

function extractGoogleCalendar(profile: Record<string, unknown> | null): Record<string, unknown> {
  if (!profile) return {};

  const fromColumn = profile.google_calendar;
  if (fromColumn && typeof fromColumn === "object") {
    return fromColumn as Record<string, unknown>;
  }

  const prefs = profile.notification_preferences;
  if (prefs && typeof prefs === "object") {
    const nested = (prefs as Record<string, unknown>).google_calendar;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
  }

  return {};
}

async function updateGoogleCalendar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  profile: Record<string, unknown> | null,
  googleCalendar: Record<string, unknown>
) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      google_calendar: googleCalendar,
      updated_at: now,
    })
    .eq("user_id", userId);

  if (!error) return;

  const message = String(error.message || "").toLowerCase();
  if (!message.includes("google_calendar")) {
    throw error;
  }

  const prefs = ((profile?.notification_preferences as Record<string, unknown> | null) ?? {});

  const { error: fallbackError } = await supabase
    .from("profiles")
    .update({
      notification_preferences: {
        ...prefs,
        google_calendar: googleCalendar,
      },
      updated_at: now,
    })
    .eq("user_id", userId);

  if (fallbackError) throw fallbackError;
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
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

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  let appUrl = "";
  let userId = "";
  let nonce = "";

  try {
    const decoded = JSON.parse(atob(stateRaw || ""));
    appUrl = decoded.appUrl || "";
    userId = decoded.userId || "";
    nonce = decoded.nonce || "";
  } catch {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const settingsUrl = `${appUrl}/settings/profile`;

  if (oauthError) {
    return Response.redirect(`${settingsUrl}?google_calendar=error&message=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !userId || !nonce) {
    return Response.redirect(
      `${settingsUrl}?google_calendar=error&message=${encodeURIComponent("Missing required OAuth parameters")}`
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const profile = (profileData as Record<string, unknown> | null) ?? null;
    const gcal = extractGoogleCalendar(profile);

    if (gcal.oauth_nonce !== nonce) {
      return Response.redirect(
        `${settingsUrl}?google_calendar=error&message=${encodeURIComponent("Invalid OAuth state — please try connecting again")}`
      );
    }

    const nonceAge = gcal.oauth_nonce_created_at
      ? Date.now() - new Date(gcal.oauth_nonce_created_at as string).getTime()
      : Infinity;
    if (nonceAge > 10 * 60 * 1000) {
      return Response.redirect(
        `${settingsUrl}?google_calendar=error&message=${encodeURIComponent("OAuth session expired — please try connecting again")}`
      );
    }

    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    const email = await getUserEmail(tokens.access_token);

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshToken = tokens.refresh_token || (gcal.refresh_token as string | undefined);

    await updateGoogleCalendar(supabase, userId, profile, {
      connected: true,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      calendar_id: "primary",
      connected_email: email,
    });

    return Response.redirect(`${settingsUrl}?google_calendar=connected`);
  } catch (error) {
    console.error("google-calendar-callback error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.redirect(`${settingsUrl}?google_calendar=error&message=${encodeURIComponent(message)}`);
  }
});
