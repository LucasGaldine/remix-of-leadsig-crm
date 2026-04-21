import { createClient } from "npm:@supabase/supabase-js@2";
import { extractBearerToken } from "../_shared/auth-header.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authToken = extractBearerToken(req.headers.get("Authorization"));
    if (!authToken) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appUrl, accountId } = await req.json();
    if (!appUrl) {
      return new Response(JSON.stringify({ error: "appUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accountId) {
      const { data: membership } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Unauthorized account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Google Calendar integration is not configured on the server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nonce = crypto.randomUUID();
    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const existingCalendar = extractGoogleCalendar((profile as Record<string, unknown> | null) ?? null);

    await updateGoogleCalendar(
      supabase,
      user.id,
      (profile as Record<string, unknown> | null) ?? null,
      {
        ...existingCalendar,
        oauth_nonce: nonce,
        oauth_nonce_created_at: new Date().toISOString(),
      }
    );

    const state = btoa(JSON.stringify({ userId: user.id, nonce, appUrl }));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("google-calendar-connect error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
