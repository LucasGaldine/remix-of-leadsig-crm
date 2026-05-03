import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Body = {
  account_id?: string;
  schedule_id?: string;
  user_id?: string | null;
  mock_profile_id?: string | null;
};

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

  const body = (await req.json().catch(() => ({}))) as Body;
  const accountId = (body.account_id || "").trim();
  const scheduleId = (body.schedule_id || "").trim();
  const userId = body.user_id?.trim() || null;
  const mockProfileId = body.mock_profile_id?.trim() || null;

  if (!accountId || !scheduleId) return json({ error: "account_id and schedule_id are required" }, 400);
  if ((userId ? 1 : 0) + (mockProfileId ? 1 : 0) !== 1) {
    return json({ error: "Provide exactly one of user_id or mock_profile_id" }, 400);
  }

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

  const { data: member } = await adminClient
    .from("account_members")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return json({ error: "Forbidden" }, 403);

  const { data: targetSchedule, error: targetError } = await adminClient
    .from("job_schedules")
    .select("scheduled_date, scheduled_time_start, scheduled_time_end")
    .eq("id", scheduleId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!targetSchedule) return json({ has_overlap: false });

  const assigneeColumn = userId ? "user_id" : "mock_crew_profile_id";
  const assigneeValue = userId || mockProfileId;

  const { data: assignments, error: assignmentsError } = await adminClient
    .from("job_assignments")
    .select("job_schedule_id")
    .eq("account_id", accountId)
    .eq(assigneeColumn, assigneeValue)
    .not("job_schedule_id", "is", null);

  if (assignmentsError) return json({ error: assignmentsError.message }, 500);

  const scheduleIds = (assignments ?? []).map((row) => row.job_schedule_id).filter(Boolean);
  if (scheduleIds.length === 0) return json({ has_overlap: false });

  const { data: schedules, error: schedulesError } = await adminClient
    .from("job_schedules")
    .select("id, scheduled_date, scheduled_time_start, scheduled_time_end")
    .in("id", scheduleIds as string[]);

  if (schedulesError) return json({ error: schedulesError.message }, 500);

  const hasOverlap = (schedules ?? []).some((existing) => {
    if (existing.scheduled_date !== targetSchedule.scheduled_date) return false;

    if (
      !existing.scheduled_time_start ||
      !existing.scheduled_time_end ||
      !targetSchedule.scheduled_time_start ||
      !targetSchedule.scheduled_time_end
    ) {
      return true;
    }

    return (
      existing.scheduled_time_start < targetSchedule.scheduled_time_end &&
      existing.scheduled_time_end > targetSchedule.scheduled_time_start
    );
  });

  return json({ has_overlap: hasOverlap });
});
