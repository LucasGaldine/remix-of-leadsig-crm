import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  event_type: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  notification_preferences: {
    channels: { email: boolean };
    digest: { frequency: "off" | "daily" | "weekly" };
  } | null;
}

interface AccountMemberRow {
  user_id: string;
  account_id: string;
  accounts: { name: string } | null;
}

const EVENT_ICONS: Record<string, string> = {
  new_lead: "&#128204;",
  lead_status_change: "&#128260;",
  payment_received: "&#128176;",
  schedule_change: "&#128197;",
  estimate_approved: "&#9989;",
};

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case "new_lead": return "New Lead";
    case "lead_status_change": return "Lead Update";
    case "payment_received": return "Payment";
    case "schedule_change": return "Schedule Change";
    case "estimate_approved": return "Estimate Approved";
    default: return "Notification";
  }
}

function buildDigestHtml(
  notifications: NotificationRow[],
  recipientName: string,
  companyName: string,
  digestType: string,
  periodStart: Date,
  periodEnd: Date
): string {
  const periodLabel = digestType === "daily" ? "Daily" : "Weekly";
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const startStr = periodStart.toLocaleDateString("en-US", dateOptions);
  const endStr = periodEnd.toLocaleDateString("en-US", dateOptions);
  const dateRange =
    startStr === endStr ? startStr : `${startStr} - ${endStr}`;

  const grouped: Record<string, NotificationRow[]> = {};
  for (const n of notifications) {
    const key = n.event_type || "other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  }

  let sectionsHtml = "";
  for (const [eventType, items] of Object.entries(grouped)) {
    const icon = EVENT_ICONS[eventType] || "&#128276;";
    const label = getEventLabel(eventType);
    const itemsHtml = items
      .map(
        (n) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;line-height:1.5;">
          <strong style="color:#111827;">${escapeHtml(n.title)}</strong><br/>
          <span style="color:#6b7280;">${escapeHtml(n.body)}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#9ca3af;font-size:12px;white-space:nowrap;vertical-align:top;">
          ${formatTime(n.created_at)}
        </td>
      </tr>`
      )
      .join("");

    sectionsHtml += `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px;padding:0;">
        ${icon} ${label} (${items.length})
      </h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
        ${itemsHtml}
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#111827;padding:24px 32px;">
        <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">
          ${periodLabel} Digest
        </h1>
        <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">${dateRange}</p>
      </div>
      <div style="padding:24px 32px;">
        <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.5;">
          Hi ${escapeHtml(recipientName || "there")}, here's your ${digestType} summary${companyName ? ` for <strong>${escapeHtml(companyName)}</strong>` : ""}.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">
            ${notifications.length} notification${notifications.length !== 1 ? "s" : ""} since your last digest
          </p>
        </div>
        ${sectionsHtml}
      </div>
      <div style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          You're receiving this because you enabled ${digestType} email digests.
          Update your preferences in Settings &gt; Notifications.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LeadSig Notifications <notification@leadsig.ai>",
      to: [to],
      subject,
      html,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result.message || `Resend error ${response.status}`,
    };
  }

  return { success: true, id: result.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY not configured",
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

    let digestFilter: "daily" | "weekly" | null = null;
    try {
      const body = await req.json();
      digestFilter = body?.digest_type || null;
    } catch {
      // No body or invalid JSON is fine - process all due digests
    }

    const now = new Date();
    const dayOfWeek = now.getUTCDay();

    const digestTypes: Array<"daily" | "weekly"> = [];
    if (!digestFilter) {
      digestTypes.push("daily");
      if (dayOfWeek === 1) digestTypes.push("weekly");
    } else {
      digestTypes.push(digestFilter);
    }

    const { data: allMembers, error: membersError } = await supabase
      .from("account_members")
      .select("user_id, account_id, accounts(name)")
      .eq("is_active", true);

    if (membersError || !allMembers?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No active members" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIds = [...new Set(allMembers.map((m: AccountMemberRow) => m.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, notification_preferences")
      .in("user_id", userIds);

    if (!profiles?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No profiles found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: Array<{
      user_id: string;
      account_id: string;
      sent: boolean;
      reason?: string;
      notification_count?: number;
    }> = [];

    for (const digestType of digestTypes) {
      const periodEnd = now;
      const periodStart = new Date(now);
      if (digestType === "daily") {
        periodStart.setUTCDate(periodStart.getUTCDate() - 1);
      } else {
        periodStart.setUTCDate(periodStart.getUTCDate() - 7);
      }

      for (const profile of profiles as ProfileRow[]) {
        const prefs = profile.notification_preferences;
        if (!prefs?.channels?.email) continue;
        if (prefs.digest?.frequency !== digestType) continue;
        if (!profile.email) continue;

        const memberEntries = allMembers.filter(
          (m: AccountMemberRow) => m.user_id === profile.user_id
        );

        for (const member of memberEntries as AccountMemberRow[]) {
          const { data: lastDigest } = await supabase
            .from("email_digest_log")
            .select("created_at")
            .eq("user_id", profile.user_id)
            .eq("account_id", member.account_id)
            .eq("digest_type", digestType)
            .eq("status", "sent")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const cutoff = lastDigest?.created_at
            ? new Date(lastDigest.created_at)
            : periodStart;

          const { data: notifications } = await supabase
            .from("notifications")
            .select("id, title, body, event_type, created_at")
            .eq("account_id", member.account_id)
            .gte("created_at", cutoff.toISOString())
            .lte("created_at", periodEnd.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

          if (!notifications?.length) {
            results.push({
              user_id: profile.user_id,
              account_id: member.account_id,
              sent: false,
              reason: "No new notifications",
              notification_count: 0,
            });
            continue;
          }

          const companyName =
            (member.accounts as unknown as { name: string })?.name || "";
          const subject =
            digestType === "daily"
              ? `Your daily digest - ${notifications.length} update${notifications.length !== 1 ? "s" : ""}`
              : `Your weekly digest - ${notifications.length} update${notifications.length !== 1 ? "s" : ""}`;

          const html = buildDigestHtml(
            notifications as NotificationRow[],
            profile.full_name || "",
            companyName,
            digestType,
            cutoff,
            periodEnd
          );

          const emailResult = await sendResendEmail(
            profile.email,
            subject,
            html,
            resendApiKey
          );

          await supabase.from("email_digest_log").insert({
            account_id: member.account_id,
            user_id: profile.user_id,
            email_to: profile.email,
            digest_type: digestType,
            notification_count: notifications.length,
            status: emailResult.success ? "sent" : "failed",
            error_message: emailResult.error || null,
            period_start: cutoff.toISOString(),
            period_end: periodEnd.toISOString(),
          });

          results.push({
            user_id: profile.user_id,
            account_id: member.account_id,
            sent: emailResult.success,
            reason: emailResult.error,
            notification_count: notifications.length,
          });
        }
      }
    }

    const sentCount = results.filter((r) => r.sent).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: results.length,
        digest_types: digestTypes,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-email-digest: Unexpected error", error);
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
