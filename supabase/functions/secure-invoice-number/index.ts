import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = { account_id?: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  const accountId = (body.account_id || "").trim();
  if (!accountId) return json({ error: "account_id is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: member, error: memberError } = await adminClient
    .from("account_members")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (memberError) return json({ error: memberError.message }, 500);
  if (!member) return json({ error: "Forbidden" }, 403);

  const { data: latest, error: latestError } = await adminClient
    .from("invoices")
    .select("invoice_number")
    .eq("account_id", accountId)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) return json({ error: latestError.message }, 500);

  const latestValue = Number(latest?.invoice_number || 0);
  return json({ invoice_number: Number.isFinite(latestValue) ? latestValue + 1 : 1 });
});
