import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendClientPortalEmailBody {
  customer_id?: string;
  portal_link?: string;
  job_id?: string;
  job_name?: string | null;
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1]?.trim() || null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(params: {
  companyName: string;
  customerName: string;
  portalLink: string;
}): string {
  const { companyName, customerName, portalLink } = params;
  const safeCompanyName = escapeHtml(companyName);
  const safeCustomerName = escapeHtml(customerName);
  const safePortalLink = escapeHtml(portalLink);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${safeCompanyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Client Portal Link</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${safeCustomerName},</p>
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
            The portal link for your project is ready. Use the button below to review your job details, photos, estimates, and invoices.
          </p>
          <p style="margin:0 0 20px;">
            <a href="${safePortalLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px;">Open Client Portal</a>
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
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPortRaw = Deno.env.get("SMTP_PORT") || "465";
    const smtpSecureRaw = Deno.env.get("SMTP_SECURE") || "true";
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
    const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";
    const smtpPort = Number(smtpPortRaw);
    const smtpSecure = smtpSecureRaw.toLowerCase() === "true";

    if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service credentials missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      customer_id: customerId,
      portal_link: portalLink,
      job_name: rawJobName,
    }: SendClientPortalEmailBody = await req.json().catch(() => ({}));

    if (!customerId || !portalLink) {
      return new Response(JSON.stringify({ error: "customer_id and portal_link are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, email, account_id")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customer.email) {
      return new Response(JSON.stringify({ error: "Customer email is missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("id")
      .eq("account_id", customer.account_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "You do not have access to this customer" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, company_email")
      .eq("id", customer.account_id)
      .maybeSingle();

    const companyName = account?.company_name?.trim() || "LeadSig";
    const customerName = customer.name?.trim() || "there";
    const subjectProjectLabel = rawJobName?.trim() || "Your project";
    const subject = `${companyName} | Client Portal - ${subjectProjectLabel}`;
    const html = buildEmailHtml({
      companyName,
      customerName,
      portalLink,
    });
    const text = [
      `Hi ${customerName},`,
      "",
      "The portal link for your project is ready. Use the link below to review your job details, photos, estimates, and invoices.",
      "",
      portalLink,
      "",
      "If the link does not work, copy and paste it into your browser.",
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
      to: [customer.email],
      replyTo: account?.company_email || undefined,
      subject,
      text,
      html,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: info.messageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-client-portal-email error:", error);
    return new Response(JSON.stringify({ error: "Failed to send portal email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
