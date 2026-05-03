import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_EMAIL = "lucas.galdine@gmail.com";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = { target_account_id?: string; target_plan?: string; target_tier?: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const callerEmail = (authData.user.email || "").trim().toLowerCase();
  if (callerEmail !== ADMIN_EMAIL) return json({ error: "Forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Body;
  const targetAccountId = (body.target_account_id || "").trim();
  if (!targetAccountId) return json({ error: "target_account_id is required" }, 400);

  const normalizedPlan = (body.target_plan || "basic").trim().toLowerCase();
  let normalizedTier: string | null = (body.target_tier || "solo").trim().toLowerCase();

  if (!["basic", "premium"].includes(normalizedPlan)) {
    return json({ error: "Manual upgrades only support basic or premium plans" }, 400);
  }
  if (normalizedPlan === "basic" && !["solo", "team", "growth"].includes(normalizedTier || "")) {
    return json({ error: "Invalid basic tier" }, 400);
  }
  if (normalizedPlan === "premium") normalizedTier = null;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await adminClient
    .from("accounts")
    .update({
      pricing_plan: normalizedPlan,
      pricing_tier: normalizedTier,
      stripe_subscription_status: "manual_upgraded",
    })
    .eq("id", targetAccountId)
    .select("id, company_name, pricing_plan, pricing_tier, stripe_subscription_status")
    .single();

  if (error) return json({ error: error.message }, 500);

  return json({ data });
});
