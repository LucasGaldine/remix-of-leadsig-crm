import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";

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

interface DigestRequestBody {
  digest_type?: "daily" | "weekly";
  test_mode?: boolean;
  test_email?: string;
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

async function sendSmtpEmail(
  to: string,
  subject: string,
  html: string,
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    const info = await transporter.sendMail({
      from: smtpConfig.from,
      to: [to],
      subject,
      html,
    });

    return { success: true, id: info.messageId };
  } catch (error) {
    const rawError =
      error instanceof Error ? error.message : "SMTP send failed";
    const normalized = rawError.toLowerCase();
    const isGmailAuthError =
      normalized.includes("535-5.7.8") ||
      normalized.includes("badcredentials") ||
      normalized.includes("username and password not accepted");

    return {
      success: false,
      error: isGmailAuthError
        ? "SMTP auth failed (Gmail 535). Ensure SMTP_USER matches the account that generated the App Password, and SMTP_PASS is the 16-character app password with no spaces."
        : rawError,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPortRaw = Deno.env.get("SMTP_PORT") || "465";
    const smtpSecureRaw = Deno.env.get("SMTP_SECURE") || "true";
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    // App passwords are often copied with spaces between groups.
    // Normalize all whitespace (including NBSP) before SMTP auth.
    const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
    const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";
    const smtpPort = Number(smtpPortRaw);
    const smtpSecure = smtpSecureRaw.toLowerCase() === "true";

    if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
      return new Response(
        JSON.stringify({
          error: "SMTP not configured",
          details:
            "Set SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_HOST, SMTP_PORT, and SMTP_SECURE",
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
    let testMode = false;
    let testUserId: string | null = null;
    let testEmail: string | null = null;
    try {
      const body: DigestRequestBody = await req.json();
      digestFilter = body?.digest_type || null;
      testMode = Boolean(body?.test_mode);
      testEmail = body?.test_email?.trim() || null;
    } catch {
      // No body or invalid JSON is fine - process all due digests
    }

    if (testMode) {
      const authHeader = req.headers.get("Authorization");
      const token =
        authHeader?.startsWith("Bearer ")
          ? authHeader.replace("Bearer ", "")
          : null;

      if (token) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (!userError && user) {
          testUserId = user.id;
        }
      }

      // Test mode should always send immediately and never depend on digest contents.
      const resolvedTestEmail = testEmail;
      if (!resolvedTestEmail && testUserId) {
        const { data: testProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", testUserId)
          .maybeSingle();
        testEmail = testProfile?.email?.trim() || null;
      }

      if (!testEmail) {
        return new Response(
          JSON.stringify({ error: "No test email available for test mode" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const subject = "LeadSig email test";
      const nowIso = new Date().toISOString();
      const html = buildDigestHtml(
        [
          {
            id: "test-email-direct",
            title: "Email test successful",
            body: "SMTP is configured correctly and LeadSig can send emails.",
            event_type: "new_lead",
            created_at: nowIso,
          },
        ],
        "there",
        "",
        "daily",
        new Date(nowIso),
        new Date(nowIso)
      );

      const emailResult = await sendSmtpEmail(testEmail, subject, html, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
      });

      return new Response(
        JSON.stringify({
          success: emailResult.success,
          sent: emailResult.success ? 1 : 0,
          total: 1,
          results: [
            {
              sent: emailResult.success,
              reason: emailResult.error,
              notification_count: 1,
            },
          ],
        }),
        {
          status: emailResult.success ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    let membersQuery = supabase
      .from("account_members")
      .select("user_id, account_id, accounts(name)")
      .eq("is_active", true);
    if (testUserId) {
      membersQuery = membersQuery.eq("user_id", testUserId);
    }

    const { data: memberRows, error: membersError } = await membersQuery;

    if (membersError || !memberRows?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No active members" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIds = [...new Set(memberRows.map((m: AccountMemberRow) => m.user_id))];

    let profileQuery = supabase
      .from("profiles")
      .select("user_id, email, full_name, notification_preferences");
    if (testUserId) {
      profileQuery = profileQuery.eq("user_id", testUserId);
    } else {
      profileQuery = profileQuery.in("user_id", userIds);
    }

    const { data: profiles } = await profileQuery;

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

        const memberEntries = memberRows.filter(
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
            .eq("user_id", profile.user_id)
            .gte("created_at", cutoff.toISOString())
            .lte("created_at", periodEnd.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

          const notificationsForEmail =
            testMode && !notifications?.length
              ? ([
                  {
                    id: "test-email",
                    title: "Test digest email",
                    body: "Your email notification channel is connected and working.",
                    event_type: "new_lead",
                    created_at: now.toISOString(),
                  },
                ] as NotificationRow[])
              : (notifications as NotificationRow[] | null);

          if (!notificationsForEmail?.length) {
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
          const subjectPrefix = testMode ? "Test: " : "";
          const subject =
            digestType === "daily"
              ? `${subjectPrefix}Your daily digest - ${notificationsForEmail.length} update${notificationsForEmail.length !== 1 ? "s" : ""}`
              : `${subjectPrefix}Your weekly digest - ${notificationsForEmail.length} update${notificationsForEmail.length !== 1 ? "s" : ""}`;

          const html = buildDigestHtml(
            notificationsForEmail,
            profile.full_name || "",
            companyName,
            digestType,
            cutoff,
            periodEnd
          );

          const emailResult = await sendSmtpEmail(
            profile.email,
            subject,
            html,
            {
              host: smtpHost,
              port: smtpPort,
              secure: smtpSecure,
              user: smtpUser,
              pass: smtpPass,
              from: smtpFrom,
            }
          );

          await supabase.from("email_digest_log").insert({
            account_id: member.account_id,
            user_id: profile.user_id,
            email_to: profile.email,
            digest_type: digestType,
            notification_count: notificationsForEmail.length,
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
            notification_count: notificationsForEmail.length,
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
