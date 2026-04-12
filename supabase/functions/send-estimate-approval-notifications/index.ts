import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  estimate_id?: string;
};

type RecipientType = "customer" | "user";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCustomerHtml(params: {
  companyName: string;
  customerName: string;
  estimateTotal: number;
  jobName: string;
}) {
  const companyName = escapeHtml(params.companyName);
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);
  const amount = Number(params.estimateTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${companyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Estimate Confirmation</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${customerName},</p>
          <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
            Thanks for approving your estimate for <strong>${jobName}</strong>.
          </p>
          <p style="margin:0 0 12px;color:#0f172a;font-size:14px;">Approved total: <strong>$${amount}</strong></p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">${companyName} will follow up with the next steps.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildUserHtml(params: {
  userName: string;
  customerName: string;
  estimateTotal: number;
  jobName: string;
  companyName: string;
}) {
  const userName = escapeHtml(params.userName || "there");
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);
  const companyName = escapeHtml(params.companyName);
  const amount = Number(params.estimateTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">Estimate Approved</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">${companyName}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${userName},</p>
          <p style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">
            ${customerName} approved the estimate for <strong>${jobName}</strong>.
          </p>
          <p style="margin:0;color:#0f172a;font-size:14px;">Approved total: <strong>$${amount}</strong></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendEmail(params: {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const transporter = nodemailer.createTransport({
    host: params.smtpHost,
    port: params.smtpPort,
    secure: params.smtpSecure,
    auth: {
      user: params.smtpUser,
      pass: params.smtpPass,
    },
  });

  return transporter.sendMail({
    from: params.smtpFrom,
    to: [params.to],
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const estimateId = body.estimate_id?.trim();

    if (!estimateId) {
      return new Response(JSON.stringify({ error: "estimate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpSecure = (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
    const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";

    if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select(`
        id,
        account_id,
        customer_id,
        job_id,
        total,
        status,
        accepted_at,
        customer:customers(name, email),
        job:leads!estimates_job_id_fkey(name)
      `)
      .eq("id", estimateId)
      .maybeSingle();

    if (estimateError || !estimate) {
      return new Response(JSON.stringify({ error: "Estimate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (estimate.status !== "accepted") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Estimate not accepted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, company_email, settings")
      .eq("id", estimate.account_id)
      .maybeSingle();

    const paymentEmails = (account?.settings as any)?.job_message_automation?.payment_emails;
    if (paymentEmails?.estimate_approved === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Estimate approved emails disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = account?.company_name?.trim() || "LeadSig";
    const companyReplyTo = account?.company_email?.trim() || undefined;
    const customerName = estimate.customer?.name?.trim() || "there";
    const jobName = estimate.job?.name?.trim() || "your project";

    const { data: members } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", estimate.account_id)
      .eq("is_active", true);

    const memberUserIds = (members || [])
      .map((row: any) => row.user_id as string)
      .filter((value: string | null | undefined): value is string => Boolean(value));

    let memberProfiles: Array<{
      user_id: string;
      email: string | null;
      full_name: string | null;
      notification_preferences: any;
    }> = [];

    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, notification_preferences")
        .in("user_id", memberUserIds);

      memberProfiles = profiles || [];
    }

    const { data: sentRows } = await supabase
      .from("estimate_email_notifications_log")
      .select("recipient_email, recipient_type")
      .eq("estimate_id", estimate.id)
      .eq("status", "sent");

    const alreadySent = new Set((sentRows || []).map((row: any) => `${row.recipient_type}:${(row.recipient_email || "").toLowerCase()}`));

    const recipients: Array<{ email: string; name: string; recipientType: RecipientType }> = [];

    const customerEmail = estimate.customer?.email?.trim();
    if (customerEmail) {
      recipients.push({ email: customerEmail, name: customerName, recipientType: "customer" });
    }

    for (const profile of memberProfiles) {
      const email = profile?.email?.trim();
      if (!email) continue;

      const prefs = profile?.notification_preferences || {};
      const channelEmailEnabled = prefs?.channels?.email !== false;
      const eventEnabled = prefs?.email_events?.estimate_approved !== false;
      if (!channelEmailEnabled || !eventEnabled) continue;

      recipients.push({
        email,
        name: profile?.full_name?.trim() || "there",
        recipientType: "user",
      });
    }

    let sent = 0;
    let skipped = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      const dedupeKey = `${recipient.recipientType}:${recipient.email.toLowerCase()}`;
      if (alreadySent.has(dedupeKey)) {
        skipped += 1;
        continue;
      }

      const subject = recipient.recipientType === "customer"
        ? `${companyName} | Estimate Approved`
        : `${companyName} | Estimate Approved by ${customerName}`;

      const html = recipient.recipientType === "customer"
        ? buildCustomerHtml({ companyName, customerName, estimateTotal: Number(estimate.total || 0), jobName })
        : buildUserHtml({ userName: recipient.name, customerName, estimateTotal: Number(estimate.total || 0), jobName, companyName });

      const text = recipient.recipientType === "customer"
        ? `Hi ${customerName},\n\nThanks for approving your estimate for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}\n\n${companyName} will follow up with the next steps.`
        : `Hi ${recipient.name},\n\n${customerName} approved the estimate for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}`;

      try {
        await sendEmail({
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPass,
          smtpFrom,
          to: recipient.email,
          subject,
          html,
          text,
          replyTo: companyReplyTo,
        });

        sent += 1;

        await supabase.from("estimate_email_notifications_log").insert({
          estimate_id: estimate.id,
          account_id: estimate.account_id,
          recipient_email: recipient.email,
          recipient_type: recipient.recipientType,
          status: "sent",
          error_message: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send email";
        errors.push({ email: recipient.email, error: message });

        await supabase.from("estimate_email_notifications_log").insert({
          estimate_id: estimate.id,
          account_id: estimate.account_id,
          recipient_email: recipient.email,
          recipient_type: recipient.recipientType,
          status: "failed",
          error_message: message,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-estimate-approval-notifications error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
