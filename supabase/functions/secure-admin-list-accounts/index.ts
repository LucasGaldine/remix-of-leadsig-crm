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

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await adminClient
    .from("accounts")
    .select("id, company_name, company_email, company_phone, created_at, pricing_plan, pricing_tier")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return json({ error: error.message }, 500);

  const accountIds = (data ?? []).map((row) => row.id);
  let members: Array<{ account_id: string; is_active: boolean; created_at: string }> = [];
  if (accountIds.length > 0) {
    const membersResult = await adminClient
      .from("account_members")
      .select("account_id, is_active, created_at")
      .in("account_id", accountIds);
    if (membersResult.error) return json({ error: membersResult.error.message }, 500);
    members = (membersResult.data ?? []) as Array<{ account_id: string; is_active: boolean; created_at: string }>;
  }

  const memberStateByAccount = new Map<string, boolean>();
  for (const member of (members ?? []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (!memberStateByAccount.has(member.account_id)) {
      memberStateByAccount.set(member.account_id, Boolean(member.is_active));
    }
  }

  const shaped = (data ?? []).map((row) => ({
    ...row,
    is_active: memberStateByAccount.get(row.id) ?? false,
  }));

  return json({ data: shaped });
});
