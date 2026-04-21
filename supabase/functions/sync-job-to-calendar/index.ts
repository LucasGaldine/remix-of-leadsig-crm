import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCHEDULE_SELECT =
  "*, leads!lead_id(name, service_type, estimated_value, address, city, state, customer:customers!customer_id(name))";

type SupabaseClient = ReturnType<typeof createClient>;

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

async function updateGoogleCalendarForUser(params: {
  supabase: SupabaseClient;
  userId: string;
  profile: Record<string, unknown> | null;
  googleCalendar: Record<string, unknown>;
}) {
  const { supabase, userId, profile, googleCalendar } = params;
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

  if (fallbackError) {
    throw fallbackError;
  }
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

function buildEventBody(job: Record<string, unknown>, schedule: Record<string, unknown>): Record<string, unknown> {
  const customerName = (job.customer as Record<string, unknown>)?.name || "Customer";
  const serviceType = (job.service_type as string) || "Service";
  const address = [job.address, job.city, job.state].filter(Boolean).join(", ");

  const summary = `${serviceType} — ${customerName}`;
  const description = [
    `Service: ${serviceType}`,
    `Customer: ${customerName}`,
    address ? `Address: ${address}` : null,
    job.estimated_value ? `Estimated Value: $${Number(job.estimated_value).toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const date = schedule.scheduled_date as string;
  const timeStart = schedule.scheduled_time_start as string | null;
  const timeEnd = schedule.scheduled_time_end as string | null;

  if (timeStart && timeEnd) {
    return {
      summary,
      description,
      start: { dateTime: `${date}T${timeStart}`, timeZone: "UTC" },
      end: { dateTime: `${date}T${timeEnd}`, timeZone: "UTC" },
    };
  }

  const nextDay = new Date(date + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    summary,
    description,
    start: { date },
    end: { date: nextDay.toISOString().split("T")[0] },
  };
}

function toIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateInTimeZone(timeZone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function getProfileForUser(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return profile;
}

async function getTodayDateForSync(params: {
  supabase: SupabaseClient;
  userId: string;
  todayDate: unknown;
}): Promise<string> {
  const { supabase, userId, todayDate } = params;

  if (typeof todayDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    return todayDate;
  }

  const profile = await getProfileForUser(supabase, userId);
  const timeZone = typeof profile?.timezone === "string" ? profile.timezone.trim() : "";

  if (timeZone) {
    try {
      return toIsoDateInTimeZone(timeZone);
    } catch {
      // Fall through to UTC fallback if profile timezone is invalid.
    }
  }

  return toIsoDateUtc(new Date());
}

async function getGoogleCalendarAccessToken(params: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; gcal: Record<string, unknown> } | null> {
  const { supabase, userId, clientId, clientSecret } = params;

  const profile = (await getProfileForUser(supabase, userId) as Record<string, unknown> | null);
  const gcal = extractGoogleCalendar(profile);

  if (!gcal.connected) return null;

  const currentAccessToken = typeof gcal.access_token === "string" ? gcal.access_token.trim() : "";
  const refreshToken = typeof gcal.refresh_token === "string" ? gcal.refresh_token.trim() : "";
  const rawExpiry = typeof gcal.token_expiry === "string" ? Date.parse(gcal.token_expiry) : NaN;
  const isTokenMissing = currentAccessToken.length === 0;
  const isTokenExpired = !Number.isFinite(rawExpiry) || Date.now() >= rawExpiry - 60_000;

  if ((isTokenMissing || isTokenExpired) && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    const nextAccessToken = refreshed.access_token;
    const tokenExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    const nextGcal = {
      ...gcal,
      access_token: nextAccessToken,
      token_expiry: tokenExpiry,
    };

    await updateGoogleCalendarForUser({
      supabase,
      userId,
      profile,
      googleCalendar: nextGcal,
    });

    return { accessToken: nextAccessToken, gcal: nextGcal };
  }

  if (!isTokenMissing) {
    return { accessToken: currentAccessToken, gcal };
  }

  return null;
}

async function upsertGoogleEvent(params: {
  accessToken: string;
  calendarId: string;
  existingEventId: string | null;
  eventBody: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; errorMessage?: string; errorCode?: number }> {
  const { accessToken, calendarId, existingEventId, eventBody } = params;

  const url = existingEventId
    ? `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`
    : `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const method = existingEventId ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  const data = await res.json();
  if (data?.error) {
    return {
      ok: false,
      errorMessage: data.error.message || "Failed to sync Google Calendar event",
      errorCode: typeof data.error.code === "number" ? data.error.code : undefined,
    };
  }

  return { ok: true, id: data.id as string | undefined };
}

async function deleteGoogleEvent(params: {
  accessToken: string;
  calendarId: string;
  googleEventId: string;
}) {
  const { accessToken, calendarId, googleEventId } = params;

  await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

async function getActiveMemberCount(supabase: SupabaseClient, accountId: string): Promise<number> {
  const { count, error } = await supabase
    .from("account_members")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load account member count: ${error.message}`);
  }

  return count ?? 0;
}

async function isScheduleAssignedToUser(params: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  scheduleId: string;
  leadId: string;
}): Promise<boolean> {
  const { supabase, accountId, userId, scheduleId, leadId } = params;

  const { data: assignment, error } = await supabase
    .from("job_assignments")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .or(`job_schedule_id.eq.${scheduleId},and(job_schedule_id.is.null,lead_id.eq.${leadId})`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load assignment: ${error.message}`);
  }

  return !!assignment;
}

async function shouldSyncScheduleForUser(params: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  scheduleId: string;
  leadId: string;
}): Promise<boolean> {
  const { supabase, accountId, userId, scheduleId, leadId } = params;

  const memberCount = await getActiveMemberCount(supabase, accountId);
  if (memberCount <= 1) {
    return true;
  }

  return isScheduleAssignedToUser({
    supabase,
    accountId,
    userId,
    scheduleId,
    leadId,
  });
}

async function getEligibleSchedulesForUser(params: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  today: string;
}): Promise<Array<Record<string, unknown>>> {
  const { supabase, accountId, userId, today } = params;

  const { data: schedules, error: schedulesError } = await supabase
    .from("job_schedules")
    .select(SCHEDULE_SELECT)
    .eq("account_id", accountId)
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true });

  if (schedulesError) {
    throw new Error(`Failed to load schedules for syncAll: ${schedulesError.message}`);
  }

  const allSchedules = (schedules ?? []) as Array<Record<string, unknown>>;
  if (allSchedules.length === 0) return [];

  const memberCount = await getActiveMemberCount(supabase, accountId);
  if (memberCount <= 1) {
    return allSchedules;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("job_assignments")
    .select("job_schedule_id, lead_id")
    .eq("account_id", accountId)
    .eq("user_id", userId);

  if (assignmentsError) {
    throw new Error(`Failed to load assignments for syncAll: ${assignmentsError.message}`);
  }

  const assignedScheduleIds = new Set<string>();
  const assignedLeadIds = new Set<string>();

  for (const assignment of assignments ?? []) {
    if (assignment.job_schedule_id) assignedScheduleIds.add(assignment.job_schedule_id);
    if (assignment.lead_id) assignedLeadIds.add(assignment.lead_id);
  }

  if (assignedScheduleIds.size === 0 && assignedLeadIds.size === 0) {
    return [];
  }

  return allSchedules.filter((schedule) => {
    const scheduleId = schedule.id as string;
    const leadId = schedule.lead_id as string;
    return assignedScheduleIds.has(scheduleId) || assignedLeadIds.has(leadId);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, scheduleId, googleEventId, accountId: bodyAccountId, todayDate } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "syncAll") {
      if (!bodyAccountId) {
        return new Response(JSON.stringify({ error: "accountId is required for syncAll" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authToken = await getGoogleCalendarAccessToken({
        supabase,
        userId: user.id,
        clientId,
        clientSecret,
      });

      if (!authToken) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "not_connected_or_missing_tokens", synced: 0, total: 0 }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const today = await getTodayDateForSync({
        supabase,
        userId: user.id,
        todayDate,
      });

      const schedules = await getEligibleSchedulesForUser({
        supabase,
        accountId: bodyAccountId,
        userId: user.id,
        today,
      });

      if (schedules.length === 0) {
        return new Response(JSON.stringify({ success: true, synced: 0, total: 0, failed: 0, first_error: null, failure_samples: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let calendarId = (authToken.gcal.calendar_id as string) || "primary";
      let switchedToPrimary = false;
      let synced = 0;
      let failed = 0;
      const failureSamples: string[] = [];

      for (const schedule of schedules) {
        try {
          const job = (schedule.leads as Record<string, unknown>) ?? {};
          const eventBody = buildEventBody(job, schedule);
          const existingEventId = schedule.google_event_id as string | null;

          let result = await upsertGoogleEvent({
            accessToken: authToken.accessToken,
            calendarId,
            existingEventId,
            eventBody,
          });

          if (!result.ok && existingEventId && result.errorCode === 404) {
            result = await upsertGoogleEvent({
              accessToken: authToken.accessToken,
              calendarId,
              existingEventId: null,
              eventBody,
            });
          }

          if (!result.ok && calendarId !== "primary" && result.errorCode === 404) {
            calendarId = "primary";
            switchedToPrimary = true;
            result = await upsertGoogleEvent({
              accessToken: authToken.accessToken,
              calendarId,
              existingEventId,
              eventBody,
            });

            if (!result.ok && existingEventId && result.errorCode === 404) {
              result = await upsertGoogleEvent({
                accessToken: authToken.accessToken,
                calendarId,
                existingEventId: null,
                eventBody,
              });
            }
          }

          if (result.ok) {
            if (result.id && result.id !== existingEventId) {
              await supabase
                .from("job_schedules")
                .update({ google_event_id: result.id, updated_at: new Date().toISOString() })
                .eq("id", schedule.id);
            }
            synced++;
          } else {
            failed++;
            if (failureSamples.length < 3) {
              failureSamples.push(result.errorMessage || "Failed to sync event");
            }
          }
        } catch (error) {
          failed++;
          if (failureSamples.length < 3) {
            const message = error instanceof Error ? error.message : "Unexpected sync error";
            failureSamples.push(message);
          }
        }
      }

      if (switchedToPrimary) {
        const profile = (await getProfileForUser(supabase, user.id) as Record<string, unknown> | null);
        await updateGoogleCalendarForUser({
          supabase,
          userId: user.id,
          profile,
          googleCalendar: { ...authToken.gcal, calendar_id: "primary" },
        });
      }

      return new Response(
        JSON.stringify({
          success: synced > 0,
          synced,
          total: schedules.length,
          failed,
          first_error: failed > 0 ? (failureSamples[0] || null) : null,
          failure_samples: failureSamples,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "delete") {
      if (!googleEventId) {
        return new Response(JSON.stringify({ skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authToken = await getGoogleCalendarAccessToken({
        supabase,
        userId: user.id,
        clientId,
        clientSecret,
      });

      if (!authToken) {
        return new Response(JSON.stringify({ skipped: true, reason: "not_connected_or_missing_tokens" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const calendarId = (authToken.gcal.calendar_id as string) || "primary";
      await deleteGoogleEvent({
        accessToken: authToken.accessToken,
        calendarId,
        googleEventId,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!scheduleId) {
      return new Response(JSON.stringify({ error: "scheduleId is required for upsert" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from("job_schedules")
      .select(SCHEDULE_SELECT)
      .eq("id", scheduleId)
      .single();

    if (scheduleError) {
      throw new Error(`Failed to load schedule for upsert: ${scheduleError.message}`);
    }

    if (!schedule) {
      return new Response(JSON.stringify({ error: "Schedule not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = schedule.account_id as string;
    const leadId = schedule.lead_id as string;

    const authToken = await getGoogleCalendarAccessToken({
      supabase,
      userId: user.id,
      clientId,
      clientSecret,
    });

    if (!authToken) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_connected_or_missing_tokens" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = await getTodayDateForSync({
      supabase,
      userId: user.id,
      todayDate,
    });

    const shouldSync = await shouldSyncScheduleForUser({
      supabase,
      accountId,
      userId: user.id,
      scheduleId,
      leadId,
    });

    const existingEventId = schedule.google_event_id as string | null;
    const calendarId = (authToken.gcal.calendar_id as string) || "primary";

    if (!shouldSync || (schedule.scheduled_date as string) < today) {
      if (existingEventId) {
        await deleteGoogleEvent({
          accessToken: authToken.accessToken,
          calendarId,
          googleEventId: existingEventId,
        });

        await supabase
          .from("job_schedules")
          .update({ google_event_id: null, updated_at: new Date().toISOString() })
          .eq("id", scheduleId);
      }

      return new Response(JSON.stringify({ skipped: true, reason: "not_eligible_for_user_or_past_schedule" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = (schedule.leads as Record<string, unknown>) ?? {};
    const eventBody = buildEventBody(job, schedule);

    let result = await upsertGoogleEvent({
      accessToken: authToken.accessToken,
      calendarId,
      existingEventId,
      eventBody,
    });

    if (!result.ok && existingEventId && result.errorCode === 404) {
      result = await upsertGoogleEvent({
        accessToken: authToken.accessToken,
        calendarId,
        existingEventId: null,
        eventBody,
      });
    }

    if (!result.ok) {
      throw new Error(result.errorMessage || "Failed to sync Google Calendar event");
    }

    const googleCalEventId = result.id || existingEventId;

    if (googleCalEventId && googleCalEventId !== existingEventId) {
      await supabase
        .from("job_schedules")
        .update({ google_event_id: googleCalEventId, updated_at: new Date().toISOString() })
        .eq("id", scheduleId);
    }

    return new Response(JSON.stringify({ success: true, googleEventId: googleCalEventId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-job-to-calendar error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
