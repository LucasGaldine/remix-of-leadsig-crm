import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmsRequest {
  event_type: string;
  account_id: string;
  data: Record<string, unknown>;
}

interface NotificationPreferences {
  channels: { push: boolean; email: boolean; sms: boolean };
  alerts: {
    new_leads: boolean;
    lead_updates: boolean;
    payments: boolean;
    schedule_changes: boolean;
    tasks: boolean;
  };
  quiet_hours: { enabled: boolean; start: string; end: string };
}

function buildMessageBody(
  eventType: string,
  data: Record<string, unknown>
): string {
  switch (eventType) {
    case "new_leads":
      return `New lead: ${data.name || "Unknown"}${data.service_type ? ` - ${data.service_type}` : ""}${data.phone ? ` (${data.phone})` : ""}`;
    case "lead_updates":
      return `Lead updated: ${data.name || "Unknown"} moved to ${data.status || "unknown"} status`;
    case "payments":
      return `Payment received: $${data.amount || 0} from ${data.customer_name || "Unknown"}`;
    case "schedule_changes":
      return `Schedule change: ${data.lead_name || "Job"} on ${data.scheduled_date || "TBD"}`;
    case "tasks":
      return `Task reminder: ${data.summary || "You have a pending task"}`;
    default:
      return `Notification: ${eventType}`;
  }
}

function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quiet_hours?.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (prefs.quiet_hours.start || "21:00")
    .split(":")
    .map(Number);
  const [endH, endM] = (prefs.quiet_hours.end || "07:00")
    .split(":")
    .map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

async function sendTwilioSms(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const credentials = btoa(`${accountSid}:${authToken}`);
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result.message || `Twilio error ${response.status}`,
    };
  }

  return { success: true, sid: result.sid };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      return new Response(
        JSON.stringify({
          error: "Twilio credentials not configured",
          details:
            "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_type, account_id, data }: SmsRequest = await req.json();

    if (!event_type || !account_id) {
      return new Response(
        JSON.stringify({ error: "event_type and account_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", account_id)
      .eq("is_active", true);

    if (membersError || !members?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          reason: "No active account members",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIds = members.map((m) => m.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, phone, notification_preferences")
      .in("user_id", userIds);

    if (!profiles?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          reason: "No profiles with phone numbers",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messageBody = buildMessageBody(event_type, data || {});
    const results: Array<{
      user_id: string;
      sent: boolean;
      reason?: string;
    }> = [];

    for (const profile of profiles) {
      if (!profile.phone) {
        results.push({
          user_id: profile.user_id,
          sent: false,
          reason: "No phone number",
        });
        continue;
      }

      const prefs =
        profile.notification_preferences as NotificationPreferences | null;

      if (!prefs?.channels?.sms) {
        results.push({
          user_id: profile.user_id,
          sent: false,
          reason: "SMS channel disabled",
        });
        continue;
      }

      const alertKey = event_type as keyof NotificationPreferences["alerts"];
      if (prefs.alerts && prefs.alerts[alertKey] === false) {
        results.push({
          user_id: profile.user_id,
          sent: false,
          reason: `Alert type ${event_type} disabled`,
        });
        continue;
      }

      if (isInQuietHours(prefs)) {
        results.push({
          user_id: profile.user_id,
          sent: false,
          reason: "Quiet hours active",
        });
        continue;
      }

      const twilioResult = await sendTwilioSms(
        profile.phone,
        messageBody,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber
      );

      await supabase.from("sms_notification_log").insert({
        account_id,
        user_id: profile.user_id,
        event_type,
        phone_to: profile.phone,
        message_body: messageBody,
        status: twilioResult.success ? "sent" : "failed",
        error_message: twilioResult.error || null,
        twilio_sid: twilioResult.sid || null,
        metadata: data || null,
      });

      results.push({
        user_id: profile.user_id,
        sent: twilioResult.success,
        reason: twilioResult.error,
      });
    }

    const sentCount = results.filter((r) => r.sent).length;

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: results.length, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-sms: Unexpected error", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
