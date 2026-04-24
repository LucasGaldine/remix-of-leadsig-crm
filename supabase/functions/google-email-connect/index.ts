import { createClient } from "npm:@supabase/supabase-js@2";
import { extractBearerToken } from "../_shared/auth-header.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getOwnerOrAdminMembership(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data || !["owner", "admin"].includes(String(data.role))) return null;
  return data;
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
    if (!authToken) return jsonResponse({ error: "Missing authorization" }, 401);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authToken);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { appUrl, accountId } = await req.json();
    if (!accountId || typeof accountId !== "string") {
      return jsonResponse({ error: "accountId is required" }, 400);
    }
    if (!appUrl || typeof appUrl !== "string") {
      return jsonResponse({ error: "appUrl is required" }, 400);
    }

    const membership = await getOwnerOrAdminMembership(supabase, accountId, user.id);
    if (!membership) return jsonResponse({ error: "Only account owners and admins can connect Google Email" }, 403);

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) {
      return jsonResponse({ error: "Google Email integration is not configured on the server" }, 500);
    }

    const nonce = crypto.randomUUID();
    const now = new Date().toISOString();
    const redirectUri = `${supabaseUrl}/functions/v1/google-email-callback`;

    const { error: upsertError } = await supabase
      .from("account_email_connections")
      .upsert(
        {
          account_id: accountId,
          provider: "google",
          connected_by_user_id: user.id,
          oauth_nonce: nonce,
          oauth_nonce_created_at: now,
          updated_at: now,
        },
        { onConflict: "account_id,provider" },
      );
    if (upsertError) throw upsertError;

    const state = btoa(JSON.stringify({ accountId, userId: user.id, nonce, appUrl }));
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return jsonResponse({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("google-email-connect error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
