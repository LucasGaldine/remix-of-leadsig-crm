import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type DeliveryChannel = "text" | "email" | "both";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

function getConnectedTwilioConfig(rawSettings: unknown): { accountSid: string; authToken: string; fromNumber: string } | null {
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) return null;

  const settings = rawSettings as Record<string, unknown>;
  const automation = settings.job_message_automation;
  if (!automation || typeof automation !== "object" || Array.isArray(automation)) return null;

  const twilio = (automation as Record<string, unknown>).twilio;
  if (!twilio || typeof twilio !== "object" || Array.isArray(twilio)) return null;

  const accountSid = (twilio as Record<string, unknown>).account_sid;
  const authToken = (twilio as Record<string, unknown>).auth_token;
  const fromNumber = (twilio as Record<string, unknown>).from_number;

  if (typeof accountSid !== "string" || typeof authToken !== "string" || typeof fromNumber !== "string") return null;

  const trimmedAccountSid = accountSid.trim();
  const trimmedAuthToken = authToken.trim();
  const normalizedFromNumber = normalizePhone(fromNumber.trim());

  if (!trimmedAccountSid || !trimmedAuthToken || !normalizedFromNumber) return null;

  return {
    accountSid: trimmedAccountSid,
    authToken: trimmedAuthToken,
    fromNumber: normalizedFromNumber,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(params: { companyName: string; customerName: string; message: string }) {
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName);
  const message = escapeHtml(params.message).replaceAll("\n", "<br />");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${company}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Job Update</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Hi ${customer},</p>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">${message}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendTwilioSms(params: {
  to: string;
  body: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);

  const form = new URLSearchParams({
    To: params.to,
    From: params.fromNumber,
    Body: params.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result?.message || `Twilio ${response.status}` };
  }

  return { success: true, sid: result.sid };
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
    const payload = await req.json().catch(() => ({}));
    const accountId = payload?.account_id || payload?.lead?.account_id;
    const leadId = payload?.lead?.id;
    const message = String(payload?.message || "").trim();
    const channel = (payload?.template?.delivery_channel || "text") as DeliveryChannel;

    if (!accountId || !leadId || !message) {
      return new Response(JSON.stringify({ error: "Missing account_id, lead.id, or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead } = await supabase
      .from("leads")
      .select("id, account_id, customer_id, name")
      .eq("id", leadId)
      .eq("account_id", accountId)
      .maybeSingle();

    if (!lead?.customer_id) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Lead has no customer" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("id", lead.customer_id)
      .maybeSingle();

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, company_email, pricing_plan, settings")
      .eq("id", accountId)
      .maybeSingle();

    if (account?.pricing_plan === "free") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Auto messaging is not available on the Free plan" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = account?.company_name?.trim() || "LeadSig";
    const customerName = customer?.name?.trim() || "there";
    const summary: Record<string, unknown> = {
      success: true,
      channel,
      sms_sent: false,
      email_sent: false,
      sms_error: null,
      email_error: null,
    };

    if (channel === "text" || channel === "both") {
      const connectedTwilio = getConnectedTwilioConfig(account?.settings);
      const toPhone = normalizePhone(customer?.phone?.trim() || "");

      if (!connectedTwilio) {
        return new Response(JSON.stringify({
          error: "Connected Twilio credentials are required for auto messaging text delivery",
          details: "Set job_message_automation.twilio.account_sid, auth_token, and from_number before sending automated texts.",
        }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (!toPhone) {
        summary.sms_error = "Customer phone missing";
      } else {
        const smsResult = await sendTwilioSms({
          to: toPhone,
          body: message,
          accountSid: connectedTwilio.accountSid,
          authToken: connectedTwilio.authToken,
          fromNumber: connectedTwilio.fromNumber,
        });
        if (smsResult.success) {
          summary.sms_sent = true;
        } else {
          summary.sms_error = smsResult.error || "SMS failed";
        }
      }
    }

    if (channel === "email" || channel === "both") {
      const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
      const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
      const smtpSecure = (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
      const smtpUser = Deno.env.get("SMTP_USER")?.trim();
      const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
      const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";

      if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
        summary.email_error = "SMTP not configured";
      } else if (!customer?.email?.trim()) {
        summary.email_error = "Customer email missing";
      } else {
        const nodemailer = await import("npm:nodemailer@6.10.1");
        const transporter = nodemailer.default.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass },
        });

        try {
          await transporter.sendMail({
            from: smtpFrom,
            to: [customer.email.trim()],
            replyTo: account?.company_email || undefined,
            subject: `${companyName} | Job Update`,
            text: `Hi ${customerName},\n\n${message}`,
            html: buildHtml({ companyName, customerName, message }),
          });
          summary.email_sent = true;
        } catch (error) {
          summary.email_error = error instanceof Error ? error.message : "Email failed";
        }
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-job-automation-message error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
