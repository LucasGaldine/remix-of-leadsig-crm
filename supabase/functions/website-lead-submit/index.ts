import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { account_id, name, email, phone, service_type, notes } = await req.json();

    if (!account_id || !name?.trim()) {
      return json({ error: "account_id and name are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the account owner to satisfy the NOT NULL created_by constraint
    const { data: member } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", account_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!member) {
      return json({ error: "Account not found" }, 404);
    }

    const { error } = await supabase.from("leads").insert({
      account_id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      service_type: service_type || null,
      notes: notes?.trim() || null,
      source: "website",
      status: "new",
      created_by: member.user_id,
    });

    if (error) throw error;

    return json({ success: true });
  } catch (err) {
    console.error("website-lead-submit error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
