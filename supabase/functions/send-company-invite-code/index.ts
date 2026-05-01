import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import { extractBearerToken } from "../_shared/auth-header.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InviteRequestBody = {
  accountId?: string;
  recipientEmail?: string;
  recipientName?: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(params: { companyName: string; recipientName: string; inviteCode: string; signupUrl: string }) {
  const companyName = escapeHtml(params.companyName);
  const recipientName = escapeHtml(params.recipientName);
  const inviteCode = escapeHtml(params.inviteCode);
  const signupUrl = escapeHtml(params.signupUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${companyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Crew Invitation</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Hi ${recipientName},</p>
          <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">
            You were invited to join <strong>${companyName}</strong> on LeadSig.
          </p>
          <p style="margin:0 0 8px;color:#334155;font-size:15px;">Use this company code during signup:</p>
          <div style="margin:0 0 16px;padding:10px 12px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:18px;font-weight:700;letter-spacing:0.08em;display:inline-block;">${inviteCode}</div>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
            Signup URL: <a href="${signupUrl}" style="color:#2563eb;">${signupUrl}</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function canUseCompanyGoogleSender(params: {
  companyEmail: string | null | undefined;
  connectedEmail: string | null | undefined;
  refreshToken: string | null | undefined;
}) {
  const companyEmail = normalizeEmail(params.companyEmail);
  const connectedEmail = normalizeEmail(params.connectedEmail);
  const refreshToken = (params.refreshToken || "").trim();

  return Boolean(companyEmail && connectedEmail && refreshToken && companyEmail === connectedEmail);
}

async function refreshGoogleAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error_description || data?.error || `Google token refresh failed (${response.status})`);
  }

  return data;
}

function buildRawMime(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];

  if (params.replyTo) {
    lines.push(`Reply-To: ${params.replyTo}`);
  }

  lines.push("", params.html);

  const mime = lines.join("\r\n");
  return btoa(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sendViaGoogle(params: {
  accessToken: string;
  connectedEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const raw = buildRawMime({
    from: params.connectedEmail,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
  });

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Gmail send failed (${response.status})`);
  }
}

async function sendViaSmtp(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const smtpPortRaw = Deno.env.get("SMTP_PORT") || "465";
  const smtpSecureRaw = Deno.env.get("SMTP_SECURE") || "true";
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
  const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";
  const smtpPort = Number(smtpPortRaw);
  const smtpSecure = smtpSecureRaw.toLowerCase() === "true";

  if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
    throw new Error("LeadSig email sender is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: [params.to],
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) return jsonResponse({ error: "Missing authorization" }, 401);

    const body: InviteRequestBody = await req.json().catch(() => ({}));
    const accountId = body.accountId?.trim();
    const recipientEmail = body.recipientEmail?.trim();
    const recipientName = body.recipientName?.trim() || "there";

    if (!accountId || !recipientEmail) {
      return jsonResponse({ error: "accountId and recipientEmail are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: membership, error: membershipError } = await supabase
      .from("account_members")
      .select("id")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return jsonResponse({ error: "Unauthorized account" }, 403);

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("company_name, company_email, invite_code")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account?.invite_code) return jsonResponse({ error: "Invite code not available" }, 400);

    const companyName = account.company_name?.trim() || "LeadSig";
    const signupUrl = `${new URL(req.url).origin.replace(/\/$/, "")}/auth`;
    const subject = `${companyName} | Company Invite Code`;
    const text = [
      `Hi ${recipientName},`,
      "",
      `You were invited to join ${companyName} on LeadSig.`,
      "Use this company code during signup:",
      account.invite_code,
      "",
      `Signup URL: ${signupUrl}`,
    ].join("\n");
    const html = buildHtml({
      companyName,
      recipientName,
      inviteCode: account.invite_code,
      signupUrl,
    });

    const { data: emailConnection } = await supabase
      .from("account_email_connections")
      .select("connected_email, access_token, refresh_token, token_expiry")
      .eq("account_id", accountId)
      .eq("provider", "google")
      .maybeSingle();

    const connectedEmail = emailConnection?.connected_email?.trim() || "";
    const refreshToken = emailConnection?.refresh_token?.trim() || "";
    let accessToken = emailConnection?.access_token?.trim() || "";
    const tokenExpiry = Date.parse(emailConnection?.token_expiry || "");
    const isTokenMissing = !accessToken;
    const isTokenExpired = !Number.isFinite(tokenExpiry) || Date.now() >= tokenExpiry - 60_000;

    const useCompanyGoogleSender = canUseCompanyGoogleSender({
      companyEmail: account.company_email,
      connectedEmail,
      refreshToken,
    });

    if (useCompanyGoogleSender) {
      try {
        if (isTokenMissing || isTokenExpired) {
          const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
          const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

          if (clientId && clientSecret) {
            const refreshed = await refreshGoogleAccessToken({
              refreshToken,
              clientId,
              clientSecret,
            });

            accessToken = refreshed.access_token;
            const nextExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

            await supabase
              .from("account_email_connections")
              .update({
                access_token: accessToken,
                token_expiry: nextExpiry,
                updated_at: new Date().toISOString(),
              })
              .eq("account_id", accountId)
              .eq("provider", "google");
          }
        }

        if (accessToken) {
          await sendViaGoogle({
            accessToken,
            connectedEmail,
            to: recipientEmail,
            subject,
            text,
            html,
            replyTo: account.company_email || undefined,
          });

          return jsonResponse({ success: true, senderType: "google" });
        }
      } catch (googleSendError) {
        console.error("send-company-invite-code google sender failed, falling back to smtp:", googleSendError);
      }
    }

    await sendViaSmtp({
      to: recipientEmail,
      subject,
      text,
      html,
      replyTo: account.company_email || undefined,
    });

    return jsonResponse({ success: true, senderType: "smtp" });
  } catch (error) {
    console.error("send-company-invite-code error:", error);
    const message = error instanceof Error ? error.message : "Failed to send invite email";
    return jsonResponse({ error: message }, 500);
  }
});
