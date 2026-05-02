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

type RecipientType = "customer" | "company";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCustomerHtml(params: { companyName: string; customerName: string; jobName: string }) {
  const companyName = escapeHtml(params.companyName);
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${companyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Change Order Declined</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${customerName},</p>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
            We recorded your decline of the requested change order for <strong>${jobName}</strong>.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildCompanyHtml(params: { recipientName: string; customerName: string; companyName: string; jobName: string }) {
  const recipientName = escapeHtml(params.recipientName || "there");
  const customerName = escapeHtml(params.customerName);
  const companyName = escapeHtml(params.companyName);
  const jobName = escapeHtml(params.jobName);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">Change Order Declined</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">${companyName}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${recipientName},</p>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
            ${customerName} declined the requested change order for <strong>${jobName}</strong>.
          </p>
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
        status,
        has_pending_changes,
        customer:customers(name, email),
        job:leads!estimates_job_id_fkey(name),
        account:accounts(company_name, company_email, pricing_plan)
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

    if (estimate.has_pending_changes === true) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Change order still pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (estimate.account?.pricing_plan === "free") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Notifications are not available on the Free plan" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = estimate.account?.company_name?.trim() || "LeadSig";
    const companyReplyTo = estimate.account?.company_email?.trim() || undefined;
    const customerName = estimate.customer?.name?.trim() || "there";
    const jobName = estimate.job?.name?.trim() || "your project";

    const recipients: Array<{ email: string; name: string; type: RecipientType }> = [];
    const customerEmail = estimate.customer?.email?.trim();
    if (customerEmail) {
      recipients.push({ email: customerEmail, name: customerName, type: "customer" });
    }

    const { data: members } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", estimate.account_id)
      .eq("is_active", true);

    const memberUserIds = (members || [])
      .map((row: any) => row.user_id as string)
      .filter((value: string | null | undefined): value is string => Boolean(value));

    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("user_id", memberUserIds);

      for (const profile of profiles || []) {
        const email = profile?.email?.trim();
        if (!email) continue;
        recipients.push({
          email,
          name: profile?.full_name?.trim() || "there",
          type: "company",
        });
      }
    }

    const deduped = new Map<string, { email: string; name: string; type: RecipientType }>();
    for (const recipient of recipients) {
      const key = recipient.email.toLowerCase();
      if (!deduped.has(key)) deduped.set(key, recipient);
    }

    let sent = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const recipient of deduped.values()) {
      const subject = recipient.type === "customer"
        ? `${companyName} | Change Order Declined`
        : `${companyName} | Change Order Declined by ${customerName}`;
      const html = recipient.type === "customer"
        ? buildCustomerHtml({ companyName, customerName, jobName })
        : buildCompanyHtml({ recipientName: recipient.name, customerName, companyName, jobName });
      const text = recipient.type === "customer"
        ? `Hi ${customerName},\n\nWe recorded your decline of the requested change order for ${jobName}.`
        : `Hi ${recipient.name},\n\n${customerName} declined the requested change order for ${jobName}.`;

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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send email";
        errors.push({ email: recipient.email, error: message });
      }
    }

    return new Response(JSON.stringify({ success: errors.length === 0, sent, errors }), {
      status: errors.length > 0 && sent === 0 ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-change-order-declined-notifications error:", error);
    return new Response(JSON.stringify({ error: "Failed to send change-order declined notifications" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
