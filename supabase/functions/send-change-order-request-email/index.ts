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
const FALLBACK_PORTAL_BASE = "http://localhost:5173";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCustomDomainBaseUrl(customDomain?: string | null): string | null {
  if (!customDomain) return null;

  const trimmed = customDomain.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

function buildClientPortalShareUrl(token: string, params: { jobId?: string | null; customDomain?: string | null; baseUrl?: string | null }) {
  const query = new URLSearchParams({ token });
  if (params.jobId) query.set("jobId", params.jobId);
  const path = `/client/job?${query.toString()}`;

  const fromCustomDomain = normalizeCustomDomainBaseUrl(params.customDomain);
  if (fromCustomDomain) return `${fromCustomDomain.replace(/\/$/, "")}${path}`;

  const fromBaseUrl = params.baseUrl?.trim();
  if (fromBaseUrl) return `${fromBaseUrl.replace(/\/$/, "")}${path}`;

  return `${FALLBACK_PORTAL_BASE}${path}`;
}

function buildEmailHtml(params: {
  companyName: string;
  customerName: string;
  portalLink: string;
  jobName: string;
}): string {
  const safeCompanyName = escapeHtml(params.companyName);
  const safeCustomerName = escapeHtml(params.customerName);
  const safePortalLink = escapeHtml(params.portalLink);
  const safeJobName = escapeHtml(params.jobName);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${safeCompanyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Change Order Request</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${safeCustomerName},</p>
          <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
            ${safeCompanyName} has requested a change order for <strong>${safeJobName}</strong>.
          </p>
          <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">
            Please review the requested changes in your client portal.
          </p>
          <p style="margin:0 0 20px;">
            <a href="${safePortalLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px;">Review Change Order</a>
          </p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;word-break:break-word;">
            If the button does not work, copy and paste this URL into your browser:<br />
            <a href="${safePortalLink}" style="color:#2563eb;">${safePortalLink}</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
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
        customer:customers(name, email, client_portal_token),
        job:leads!estimates_job_id_fkey(name),
        account:accounts(company_name, company_email, settings)
      `)
      .eq("id", estimateId)
      .maybeSingle();

    if (estimateError || !estimate) {
      return new Response(JSON.stringify({ error: "Estimate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (estimate.status !== "accepted" || estimate.has_pending_changes !== true) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No pending change order request" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = estimate.customer?.email?.trim();
    if (!customerEmail) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Customer email missing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let portalToken = estimate.customer?.client_portal_token || null;
    if (!portalToken) {
      portalToken = crypto.randomUUID();
      const { error: tokenUpdateError } = await supabase
        .from("customers")
        .update({ client_portal_token: portalToken })
        .eq("id", estimate.customer_id);

      if (tokenUpdateError) {
        return new Response(JSON.stringify({ error: "Failed to provision client portal token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const companyName = estimate.account?.company_name?.trim() || "LeadSig";
    const companyReplyTo = estimate.account?.company_email?.trim() || undefined;
    const customerName = estimate.customer?.name?.trim() || "there";
    const jobName = estimate.job?.name?.trim() || "your project";
    const customDomain = (estimate.account?.settings as any)?.website?.custom_domain ?? null;

    const portalLink = buildClientPortalShareUrl(portalToken, {
      jobId: estimate.job_id,
      customDomain,
      baseUrl: Deno.env.get("SITE_URL") || null,
    });

    const subject = `${companyName} | Change Order Requested - ${jobName}`;
    const html = buildEmailHtml({ companyName, customerName, portalLink, jobName });
    const text = [
      `Hi ${customerName},`,
      "",
      `${companyName} has requested a change order for ${jobName}.`,
      "Please review the requested changes in your client portal:",
      portalLink,
    ].join("\n");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: [customerEmail],
      replyTo: companyReplyTo,
      subject,
      text,
      html,
    });

    return new Response(JSON.stringify({ success: true, message_id: info.messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-change-order-request-email error:", error);
    return new Response(JSON.stringify({ error: "Failed to send change order request email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
