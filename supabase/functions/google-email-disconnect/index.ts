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

    const { accountId } = await req.json();
    if (!accountId || typeof accountId !== "string") {
      return jsonResponse({ error: "accountId is required" }, 400);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !["owner", "admin"].includes(String(membership.role))) {
      return jsonResponse({ error: "Only account owners and admins can disconnect Google Email" }, 403);
    }

    const { error: deleteError } = await supabase
      .from("account_email_connections")
      .delete()
      .eq("account_id", accountId)
      .eq("provider", "google");
    if (deleteError) throw deleteError;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("google-email-disconnect error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
