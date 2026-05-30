import nodemailer from "npm:nodemailer@6.10.1";
import { jsPDF as JsPDF } from "npm:jspdf@2.5.2";
import { format } from "npm:date-fns@3.6.0";

export type EmailAttachment = { filename: string; content: Uint8Array; contentType: string };
export type RecipientType = "customer" | "user";
export type SignedCopyRecipient = { email: string; name: string; recipientType: RecipientType };

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "customer";
}

export function stripMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BUILT_IN_TEMPLATE_VARIABLE_KEYS = new Set([
  "scope_of_work",
  "job_name",
  "job_address",
  "service_type",
  "client_name",
  "client_email",
  "client_phone",
  "company_name",
  "company_email",
  "company_phone",
  "estimate_total",
  "estimate_subtotal",
  "estimate_tax",
  "estimate_discount",
  "default_payment_schedule",
  "default_payment_deposit_percentage",
  "default_payment_midpoint_percentage",
  "default_payment_final_percentage",
  "current_date",
]);
const DEFAULT_BUILT_IN_TEMPLATE_FALLBACK = "Not provided";

function resolveTemplateVariableFallbackValue(key: string) {
  const normalizedKey = normalizeText(key).toLowerCase();
  if (!normalizedKey) return "";
  if (normalizedKey === "current_date") {
    return new Date().toISOString().slice(0, 10);
  }
  if (BUILT_IN_TEMPLATE_VARIABLE_KEYS.has(normalizedKey)) {
    return DEFAULT_BUILT_IN_TEMPLATE_FALLBACK;
  }
  return "";
}

function formatPhoneTemplateValue(value: string) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return trimmed;
}

function maybeFormatTemplateMergeFieldValue(key: string, value: string) {
  if (/(^|_)phone$/.test(key)) {
    return formatPhoneTemplateValue(value);
  }
  return value;
}

export function renderTemplate(text: string, fields: Record<string, string>) {
  return text.replace(/(?:\[\[\s*([a-z0-9_]+)\s*\]\]|\{\{\s*([a-z0-9_]+)\s*\}\})/gi, (_, a, b) => {
    const key = normalizeText(String(a || b || "")).toLowerCase();
    const rawValue = fields[key];
    const normalizedValue = normalizeText(rawValue);
    if (!normalizedValue) return resolveTemplateVariableFallbackValue(key);
    const formattedValue = maybeFormatTemplateMergeFieldValue(key, normalizedValue);
    if (formattedValue) return formattedValue;
    return resolveTemplateVariableFallbackValue(key);
  });
}

async function getImageDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Failed to load image");

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function resolveImageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  const contentType = (match?.[1] || "").toLowerCase();
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "JPEG";
  return "PNG";
}

export async function buildSignedTemplatePdf(params: {
  title: string;
  body: string;
  customerName: string;
  prefix: string;
  includeSignatureSection?: boolean;
  signatureImageUrl?: string;
  signatureDateIso?: string;
}): Promise<EmailAttachment> {
  const {
    title,
    body,
    customerName,
    prefix,
    includeSignatureSection = false,
    signatureImageUrl = "",
    signatureDateIso = "",
  } = params;

  const doc = new JsPDF();
  const margin = 20;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 9;

  doc.setFontSize(11);
  const lines = doc.splitTextToSize(stripMarkdown(body), width);
  for (const line of lines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(line), margin, y);
    y += 6;
  }

  if (includeSignatureSection) {
    if (y > 235) {
      doc.addPage();
      y = 20;
    }

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Signature", margin, y);
    y += 6;

    const pageRight = doc.internal.pageSize.getWidth() - margin;
    const signatureUrl = normalizeText(signatureImageUrl);
    const hasCapturedSignature = Boolean(signatureUrl);
    const signedDateLabel = normalizeText(signatureDateIso)
      ? format(new Date(signatureDateIso), "MMMM d, yyyy")
      : format(new Date(), "MMMM d, yyyy");

    if (hasCapturedSignature) {
      const lineY = y + 10;
      const dateX = Math.min(margin + 105, pageRight - 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text("Client Signature", margin, lineY + 6);
      doc.text("Date", dateX, lineY + 6);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(signedDateLabel, dateX, lineY + 12);

      const sigY = lineY + 10;
      try {
        const signatureDataUrl = await getImageDataUrl(signatureUrl);
        doc.addImage(signatureDataUrl, resolveImageFormatFromDataUrl(signatureDataUrl), margin, sigY, 90, 20);
      } catch {
        // Keep labels/date even when signature image fetch fails.
      }
      y = sigY + 22;
    } else {
      const lineY = y + 10;
      const dateX = Math.min(margin + 105, pageRight - 35);
      doc.setDrawColor(120, 120, 120);
      doc.line(margin, lineY, Math.min(margin + 90, pageRight), lineY);
      doc.line(dateX, lineY, Math.min(dateX + 45, pageRight), lineY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text("Client Signature", margin, lineY + 6);
      doc.text("Date", dateX, lineY + 6);
      doc.setTextColor(0, 0, 0);
      y = lineY + 12;
    }
  }

  return {
    filename: `${prefix}-${sanitizeFilePart(customerName)}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
    content: new Uint8Array(doc.output("arraybuffer")),
    contentType: "application/pdf",
  };
}

export function buildSignedCopyRecipients(params: {
  customerEmail: string;
  customerName: string;
  companyEmail: string;
  companyName: string;
  profileEmails?: string[];
}): SignedCopyRecipient[] {
  const recipients: SignedCopyRecipient[] = [];
  const keys = new Set<string>();
  const add = (emailRaw: string, name: string, recipientType: RecipientType) => {
    const email = normalizeText(emailRaw).toLowerCase();
    if (!email) return;
    const key = `${recipientType}:${email}`;
    if (keys.has(key)) return;
    keys.add(key);
    recipients.push({ email, name, recipientType });
  };

  add(params.customerEmail, params.customerName || "Customer", "customer");
  add(params.companyEmail, params.companyName || "Team", "user");
  for (const profileEmail of params.profileEmails || []) {
    add(profileEmail, params.companyName || "Team", "user");
  }
  return recipients;
}

function buildSignedCopyHtml(params: {
  companyName: string;
  customerName: string;
  portalLink: string;
  documentListHtml: string;
  signatureUrl: string;
  isCustomer: boolean;
}) {
  const { companyName, customerName, portalLink, documentListHtml, signatureUrl, isCustomer } = params;
  const intro = isCustomer
    ? "Attached are the signed document copies from your client portal."
    : `${escapeHtml(customerName)} signed document(s) in the client portal.`;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:18px 22px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(companyName)}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Signed Document Copy</p>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.6;">${intro}</p>
          <p style="margin:0 0 10px;color:#334155;font-size:14px;">Signed document links:</p>
          <ul style="margin:0 0 14px 18px;color:#334155;font-size:14px;line-height:1.5;">${documentListHtml}</ul>
          <p style="margin:0 0 10px;color:#334155;font-size:14px;">Signature image:</p>
          <p style="margin:0 0 14px;"><a href="${escapeHtml(signatureUrl)}" style="color:#2563eb;">${escapeHtml(signatureUrl)}</a></p>
          <p style="margin:0 0 10px;color:#334155;font-size:14px;">Client portal:</p>
          <p style="margin:0;"><a href="${escapeHtml(portalLink)}" style="color:#2563eb;">${escapeHtml(portalLink)}</a></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendSignedCopyEmails(params: {
  recipients: SignedCopyRecipient[];
  attachments: Array<{ filename: string; content: Uint8Array; contentType?: string }>;
  companyName: string;
  customerName: string;
  portalLink: string;
  signatureUrl: string;
  documentSummaries: Array<{ name: string; url: string }>;
  replyTo?: string;
}): Promise<{ ok: true; sent: number; failed: Array<{ email: string; error: string }> } | { ok: false; error: string; sent: number; failed: Array<{ email: string; error: string }> }> {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
  const smtpSecure = String(Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
  const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";
  if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
    return { ok: false, error: "SMTP not configured.", sent: 0, failed: [] };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const listText = params.documentSummaries.map((doc) => `- ${doc.name}: ${doc.url}`).join("\n");
  const listHtml = params.documentSummaries
    .map((doc) => `<li><a href="${escapeHtml(doc.url)}" style="color:#2563eb;">${escapeHtml(doc.name)}</a></li>`)
    .join("");

  let sent = 0;
  const failed: Array<{ email: string; error: string }> = [];
  for (const recipient of params.recipients) {
    const isCustomer = recipient.recipientType === "customer";
    const subject = isCustomer
      ? `${params.companyName} | Signed Document Copy`
      : `${params.companyName} | Signed Document Copy from ${params.customerName}`;
    const text = isCustomer
      ? [
        `Hi ${params.customerName},`,
        "",
        "Attached are the signed document copies from your client portal.",
        "",
        "Signed document links:",
        listText,
        "",
        `Signature image: ${params.signatureUrl}`,
        `Client portal: ${params.portalLink}`,
      ].join("\n")
      : [
        `Hi ${recipient.name || "Team"},`,
        "",
        `${params.customerName} signed document(s) in the client portal.`,
        "",
        "Signed document links:",
        listText,
        "",
        `Signature image: ${params.signatureUrl}`,
        `Client portal: ${params.portalLink}`,
      ].join("\n");

    const html = buildSignedCopyHtml({
      companyName: params.companyName,
      customerName: params.customerName,
      portalLink: params.portalLink,
      documentListHtml: listHtml,
      signatureUrl: params.signatureUrl,
      isCustomer,
    });

    try {
      const delivery = await transporter.sendMail({
        from: smtpFrom,
        to: [recipient.email],
        replyTo: params.replyTo || undefined,
        subject,
        text,
        html,
        attachments: params.attachments,
      });

      const rejected = Array.isArray(delivery.rejected) ? delivery.rejected : [];
      if (rejected.length > 0) {
        failed.push({ email: recipient.email, error: "Rejected by email provider." });
        continue;
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email";
      failed.push({ email: recipient.email, error: message });
    }
  }
  if (sent === 0) {
    return { ok: false, error: "Failed to deliver signed document emails.", sent, failed };
  }
  return { ok: true, sent, failed };
}
