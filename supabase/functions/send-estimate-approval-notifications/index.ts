import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import { jsPDF as JsPDF } from "npm:jspdf@2.5.2";
import { format } from "npm:date-fns@3.6.0";
type JsPdfDoc = InstanceType<typeof JsPDF>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  estimate_id?: string;
  event_type?: "estimate_approved" | "change_order_approved";
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
  eventType: "estimate_approved" | "change_order_approved";
}) {
  const companyName = escapeHtml(params.companyName);
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);
  const amount = Number(params.estimateTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const approvalLabel = params.eventType === "change_order_approved" ? "change order" : "estimate";

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
            Thanks for approving your ${approvalLabel} for <strong>${jobName}</strong>.
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
  eventType: "estimate_approved" | "change_order_approved";
}) {
  const userName = escapeHtml(params.userName || "there");
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);
  const companyName = escapeHtml(params.companyName);
  const amount = Number(params.estimateTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const approvedLabel = params.eventType === "change_order_approved" ? "change order" : "estimate";
  const title = params.eventType === "change_order_approved" ? "Change Order Approved" : "Estimate Approved";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${title}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">${companyName}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${userName},</p>
          <p style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">
            ${customerName} approved the ${approvedLabel} for <strong>${jobName}</strong>.
          </p>
          <p style="margin:0;color:#0f172a;font-size:14px;">Approved total: <strong>$${amount}</strong></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function getImageDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to load image");
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function resolveImageFormat(imageDataUrl: string) {
  if (imageDataUrl.startsWith("data:image/jpeg") || imageDataUrl.startsWith("data:image/jpg")) {
    return "JPEG";
  }

  if (imageDataUrl.startsWith("data:image/webp")) {
    return "WEBP";
  }

  return "PNG";
}

async function addCompanyLogo(doc: JsPdfDoc, logoUrl: string | undefined, margin: number, yPosition: number) {
  if (!logoUrl) return yPosition;

  try {
    const logoDataUrl = await getImageDataUrl(logoUrl);
    const logoProps = doc.getImageProperties(logoDataUrl);
    const maxLogoWidth = 36;
    const maxLogoHeight = 18;
    const widthScale = maxLogoWidth / logoProps.width;
    const heightScale = maxLogoHeight / logoProps.height;
    const logoScale = Math.min(widthScale, heightScale);
    const logoWidth = logoProps.width * logoScale;
    const logoHeight = logoProps.height * logoScale;

    doc.addImage(logoDataUrl, "PNG", margin, yPosition, logoWidth, logoHeight);
    return yPosition + logoHeight + 6;
  } catch {
    return yPosition;
  }
}

function addHeader(doc: JsPdfDoc, title: string, margin: number, yPosition: number) {
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, yPosition);
  return yPosition + 15;
}

function addGeneratedTimestamp(doc: JsPdfDoc, margin: number, yPosition: number) {
  const timestamp = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${timestamp}`, margin, yPosition);
  doc.setTextColor(0, 0, 0);
  return yPosition + 15;
}

function addCompanySection(
  doc: JsPdfDoc,
  company: { name?: string | null; email?: string | null; phone?: string | null },
  margin: number,
  yPosition: number,
) {
  if (!company.name) return yPosition;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(company.name, margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (company.email) {
    doc.text(company.email, margin, yPosition);
    yPosition += 5;
  }

  if (company.phone) {
    doc.text(company.phone, margin, yPosition);
    yPosition += 5;
  }

  return yPosition + 5;
}

function addRecipientSection(
  doc: JsPdfDoc,
  recipient: { customerName: string; jobName: string; address?: string | null },
  margin: number,
  yPosition: number,
) {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", margin, yPosition);
  yPosition += 6;

  doc.setFont("helvetica", "normal");
  doc.text(recipient.customerName, margin, yPosition);
  yPosition += 5;

  if (recipient.jobName) {
    doc.text(recipient.jobName, margin, yPosition);
    yPosition += 5;
  }

  if (recipient.address) {
    doc.text(recipient.address, margin, yPosition);
    yPosition += 5;
  }

  return yPosition + 10;
}

function addDocumentMeta(doc: JsPdfDoc, lines: string[], margin: number, yPosition: number) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  for (const line of lines) {
    doc.text(line, margin, yPosition);
    yPosition += 5;
  }

  doc.setTextColor(0, 0, 0);
  return yPosition + 5;
}

function addLineItemsTable(
  doc: JsPdfDoc,
  lineItems: Array<{
    name: string;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unit_price?: number | null;
    total?: number | null;
  }>,
  margin: number,
  pageWidth: number,
  yPosition: number,
) {
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 2, yPosition + 5);
  doc.text("Qty", pageWidth - 100, yPosition + 5);
  doc.text("Price", pageWidth - 70, yPosition + 5);
  doc.text("Total", pageWidth - margin - 2, yPosition + 5, { align: "right" });

  yPosition += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const item of lineItems) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(item.name || "Line item", margin, yPosition);
    yPosition += 5;

    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 20);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 4;
      doc.setFontSize(10);
    }

    doc.setFont("helvetica", "normal");
    doc.text(`${Number(item.quantity || 0)} ${item.unit || ""}`.trim(), pageWidth - 100, yPosition);
    doc.text(`$${Number(item.unit_price || 0).toFixed(2)}`, pageWidth - 70, yPosition);
    doc.text(`$${Number(item.total || 0).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });

    yPosition += 8;
  }

  return yPosition;
}

function addSummary(
  doc: JsPdfDoc,
  params: { subtotal: number; taxRate: number; tax: number; discount: number; total: number },
  margin: number,
  pageWidth: number,
  yPosition: number,
) {
  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const summaryX = pageWidth - 80;
  doc.setFont("helvetica", "normal");

  doc.text("Subtotal:", summaryX, yPosition);
  doc.text(`$${Number(params.subtotal).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 6;

  doc.text(`Tax (${(params.taxRate * 100).toFixed(1)}%):`, summaryX, yPosition);
  doc.text(`$${Number(params.tax).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 6;

  if (params.discount > 0) {
    doc.text("Discount:", summaryX, yPosition);
    doc.text(`-$${Number(params.discount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
    yPosition += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", summaryX, yPosition);
  doc.text(`$${Number(params.total).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  return yPosition + 8;
}

function addNotes(doc: JsPdfDoc, notes: string | undefined, margin: number, pageWidth: number, yPosition: number) {
  if (!notes) return yPosition;

  yPosition += 15;
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Notes:", margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(notes, pageWidth - margin * 2);
  doc.text(notesLines, margin, yPosition);
  return yPosition + notesLines.length * 4;
}

async function addSignaturePage(
  doc: JsPdfDoc,
  signatureImageUrl: string | undefined,
  margin: number,
  pageWidth: number,
  pageHeight: number,
) {
  if (!signatureImageUrl) return;

  try {
    const signatureDataUrl = await getImageDataUrl(signatureImageUrl);
    const signatureProps = doc.getImageProperties(signatureDataUrl);
    const imageFormat = resolveImageFormat(signatureDataUrl);

    doc.addPage();
    let yPosition = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Signature", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Captured during estimate approval", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;

    const maxImageWidth = pageWidth - margin * 2;
    const maxImageHeight = pageHeight - yPosition - margin;
    const widthScale = maxImageWidth / signatureProps.width;
    const heightScale = maxImageHeight / signatureProps.height;
    const imageScale = Math.min(widthScale, heightScale);
    const imageWidth = signatureProps.width * imageScale;
    const imageHeight = signatureProps.height * imageScale;
    const imageX = (pageWidth - imageWidth) / 2;

    doc.addImage(signatureDataUrl, imageFormat, imageX, yPosition, imageWidth, imageHeight);
  } catch {
    // Keep PDF generation resilient when signature image fails to load.
  }
}

async function buildEstimatePdfAttachment(params: {
  estimateId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  customerName: string;
  jobName: string;
  address?: string | null;
  total: number;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  notes?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  signatureImageUrl?: string | null;
  acceptedAt?: string | null;
  lineItems: Array<{
    name: string;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unit_price?: number | null;
    total?: number | null;
    sort_order?: number | null;
    is_change_order?: boolean | null;
    change_order_type?: string | null;
  }>;
}) {
  const doc = new JsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 20;

  yPosition = await addCompanyLogo(doc, params.companyLogoUrl || undefined, margin, yPosition);
  yPosition = addHeader(doc, "ESTIMATE", margin, yPosition);
  yPosition = addGeneratedTimestamp(doc, margin, yPosition);
  yPosition = addCompanySection(
    doc,
    { name: params.companyName, email: params.companyEmail, phone: params.companyPhone },
    margin,
    yPosition,
  );
  yPosition = addRecipientSection(
    doc,
    { customerName: params.customerName, jobName: params.jobName, address: params.address },
    margin,
    yPosition,
  );

  const metaLines: string[] = [];
  if (params.createdAt) metaLines.push(`Created: ${format(new Date(params.createdAt), "MMM d, yyyy")}`);
  if (params.expiresAt) metaLines.push(`Expires: ${format(new Date(params.expiresAt), "MMM d, yyyy")}`);
  if (!params.createdAt && params.acceptedAt) metaLines.push(`Approved: ${format(new Date(params.acceptedAt), "MMM d, yyyy")}`);
  if (metaLines.length > 0) {
    yPosition = addDocumentMeta(doc, metaLines, margin, yPosition);
  }

  const visibleLineItems = params.lineItems
    .filter((item) => !item.is_change_order || item.change_order_type !== "deleted")
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  yPosition = addLineItemsTable(doc, visibleLineItems, margin, pageWidth, yPosition);
  yPosition = addSummary(
    doc,
    {
      subtotal: Number(params.subtotal || 0),
      taxRate: Number(params.taxRate || 0),
      tax: Number(params.tax || 0),
      discount: Number(params.discount || 0),
      total: Number(params.total || 0),
    },
    margin,
    pageWidth,
    yPosition,
  );
  addNotes(doc, params.notes || undefined, margin, pageWidth, yPosition);
  await addSignaturePage(doc, params.signatureImageUrl || undefined, margin, pageWidth, pageHeight);

  const attachmentBuffer = doc.output("arraybuffer");
  const filenameSafeCustomer = params.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "customer";
  return {
    filename: `estimate-${filenameSafeCustomer}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
    content: new Uint8Array(attachmentBuffer),
    contentType: "application/pdf",
  };
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
  attachments?: Array<{
    filename: string;
    content: Uint8Array;
    contentType: string;
  }>;
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
    attachments: params.attachments,
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
    const eventType = body.event_type === "change_order_approved" ? "change_order_approved" : "estimate_approved";

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
        created_at,
        expires_at,
        total,
        subtotal,
        tax_rate,
        tax,
        discount,
        notes,
        status,
        accepted_at,
        manual_approval_photo_url,
        customer:customers(name, email),
        job:leads!estimates_job_id_fkey(name, address),
        line_items:estimate_line_items(name, description, quantity, unit, unit_price, total, sort_order, is_change_order, change_order_type)
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

    // Only send estimate-approval emails when a signature image is present.
    // Manual approvals without a signature should not notify anyone.
    if (eventType === "estimate_approved" && !(estimate as any).manual_approval_photo_url) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: "Signature is required before sending estimate approval emails",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings, pricing_plan")
      .eq("id", estimate.account_id)
      .maybeSingle();

    if (account?.pricing_plan === "free") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Notifications are not available on the Free plan" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const pdfAttachment = await buildEstimatePdfAttachment({
      estimateId: estimate.id,
      companyName,
      companyLogoUrl: (account as any)?.logo_url || null,
      companyEmail: account?.company_email || null,
      companyPhone: (account as any)?.company_phone || null,
      customerName,
      jobName,
      address: (estimate as any)?.job?.address || null,
      total: Number(estimate.total || 0),
      subtotal: Number((estimate as any).subtotal || 0),
      taxRate: Number((estimate as any).tax_rate || 0),
      tax: Number((estimate as any).tax || 0),
      discount: Number((estimate as any).discount || 0),
      notes: (estimate as any).notes || null,
      createdAt: (estimate as any).created_at || null,
      expiresAt: (estimate as any).expires_at || null,
      signatureImageUrl: (estimate as any).manual_approval_photo_url || null,
      acceptedAt: estimate.accepted_at || null,
      lineItems: (estimate as any).line_items || [],
    });

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
      .eq("event_type", eventType)
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
        ? (eventType === "change_order_approved"
          ? `${companyName} | Change Order Approved`
          : `${companyName} | Estimate Approved`)
        : (eventType === "change_order_approved"
          ? `${companyName} | Change Order Approved by ${customerName}`
          : `${companyName} | Estimate Approved by ${customerName}`);

      const html = recipient.recipientType === "customer"
        ? buildCustomerHtml({ companyName, customerName, estimateTotal: Number(estimate.total || 0), jobName, eventType })
        : buildUserHtml({ userName: recipient.name, customerName, estimateTotal: Number(estimate.total || 0), jobName, companyName, eventType });

      const text = recipient.recipientType === "customer"
        ? (eventType === "change_order_approved"
          ? `Hi ${customerName},\n\nThanks for approving your change order for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}\n\n${companyName} will follow up with the next steps.`
          : `Hi ${customerName},\n\nThanks for approving your estimate for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}\n\n${companyName} will follow up with the next steps.`)
        : (eventType === "change_order_approved"
          ? `Hi ${recipient.name},\n\n${customerName} approved the change order for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}`
          : `Hi ${recipient.name},\n\n${customerName} approved the estimate for ${jobName}.\nApproved total: $${Number(estimate.total || 0).toFixed(2)}`);

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
          attachments: [pdfAttachment],
        });

        sent += 1;

        await supabase.from("estimate_email_notifications_log").insert({
          estimate_id: estimate.id,
          account_id: estimate.account_id,
          event_type: eventType,
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
          event_type: eventType,
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
