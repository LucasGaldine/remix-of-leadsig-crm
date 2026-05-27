import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import { jsPDF as JsPDF } from "npm:jspdf@2.5.2";
import { format } from "npm:date-fns@3.6.0";
import {
  buildSignedTemplatePdf,
  normalizeText,
  renderTemplate,
  sanitizeFilePart,
} from "../_shared/signed-copy.ts";

type RequestBody = {
  estimate_id?: string;
  event_type?: "estimate_approved" | "change_order_approved";
  force_resend?: boolean;
};

type RecipientType = "customer" | "user";
type EmailAttachment = { filename: string; content: Uint8Array; contentType: string };

type JobDocumentConfig = {
  id?: string | null;
  lead_id?: string | null;
  template_id?: string | null;
  include_in_job?: boolean | null;
  email_timing?: string | null;
  requires_signature?: boolean | null;
  template?: { name?: string | null; system_key?: string | null; body?: string | null } | null;
};
type JobDocument = {
  id?: string | null;
  lead_id?: string | null;
  template_id?: string | null;
  config_id?: string | null;
  document_key?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
};

async function loadJobDocuments(supabase: any, leadIds: string[]): Promise<JobDocument[]> {
  const primary = await supabase
    .from("job_documents")
    .select("id,lead_id,template_id,config_id,document_key,file_name,file_path,mime_type,created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  if (!primary.error) return (primary.data || []) as JobDocument[];

  const fallback = await supabase
    .from("job_documents")
    .select("id,lead_id,document_type,file_name,file_path,mime_type,created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  if (fallback.error) return [];
  return ((fallback.data || []) as any[]).map((row) => ({
    id: row.id,
    lead_id: row.lead_id,
    template_id: null,
    config_id: null,
    document_key: row.document_type || "",
    file_name: row.file_name,
    file_path: row.file_path,
    mime_type: row.mime_type,
    created_at: row.created_at,
  })) as JobDocument[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
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

function normalizeTiming(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveTemplateBody(
  template: { system_key?: string | null; body?: string | null } | null | undefined,
  agreementTemplates: Record<string, unknown>,
) {
  const body = normalizeText(template?.body);
  if (body) return body;

  const key = normalizeText(template?.system_key);
  if (key === "job_agreement") return normalizeText(agreementTemplates.job_agreement);
  if (key === "warranty_agreement") return normalizeText(agreementTemplates.warranty_agreement);
  if (key === "job_release") return normalizeText(agreementTemplates.job_release);
  return "";
}

function buildEstimatePdf(params: {
  eventType: "estimate_approved" | "change_order_approved";
  companyName: string;
  customerName: string;
  jobName: string;
  address?: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  lineItems: Array<{ name?: string | null; quantity?: number | null; unit?: string | null; unit_price?: number | null; total?: number | null; description?: string | null; sort_order?: number | null; is_change_order?: boolean | null; change_order_type?: string | null }>;
}): EmailAttachment {
  const doc = new JsPDF();
  const margin = 20;
  const right = doc.internal.pageSize.getWidth() - margin;
  let y = 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(params.eventType === "change_order_approved" ? "CHANGE ORDER" : "ESTIMATE", margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(params.companyName, margin, y);
  y += 6;
  doc.text(`Bill To: ${params.customerName}`, margin, y);
  y += 6;
  doc.text(`Project: ${params.jobName}`, margin, y);
  y += 6;
  if (params.address) {
    doc.text(`Address: ${params.address}`, margin, y);
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Description", margin, y);
  doc.text("Qty", right - 45, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 5;
  doc.setLineWidth(0.2);
  doc.line(margin, y, right, y);
  y += 6;

  const rows = params.lineItems
    .filter((i) => !i?.is_change_order || i?.change_order_type !== "deleted")
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const item of rows) {
    const name = normalizeText(item?.name) || "Line item";
    const qty = `${Number(item?.quantity || 0)} ${normalizeText(item?.unit)}`.trim();
    const total = `$${Number(item?.total || 0).toFixed(2)}`;
    const desc = normalizeText(item?.description);

    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(name, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(qty, right - 45, y, { align: "right" });
    doc.text(total, right, y, { align: "right" });
    y += 5;

    if (desc) {
      const wrapped = doc.splitTextToSize(desc, right - margin - 55);
      for (const line of wrapped) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(String(line), margin + 2, y);
        y += 4;
      }
    }

    y += 2;
  }

  if (y > 245) {
    doc.addPage();
    y = 20;
  }

  const summaryX = right - 65;
  doc.setFontSize(10);
  doc.text("Subtotal:", summaryX, y);
  doc.text(`$${params.subtotal.toFixed(2)}`, right, y, { align: "right" });
  y += 6;
  doc.text(`Tax (${(params.taxRate * 100).toFixed(1)}%):`, summaryX, y);
  doc.text(`$${params.tax.toFixed(2)}`, right, y, { align: "right" });
  y += 6;
  if (params.discount > 0) {
    doc.text("Discount:", summaryX, y);
    doc.text(`-$${params.discount.toFixed(2)}`, right, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Total:", summaryX, y);
  doc.text(`$${params.total.toFixed(2)}`, right, y, { align: "right" });

  if (normalizeText(params.notes)) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(params.notes || "", right - margin);
    for (const line of wrapped) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(line), margin, y);
      y += 5;
    }
  }

  return {
    filename: `${params.eventType === "change_order_approved" ? "change-order" : "estimate"}-${sanitizeFilePart(params.customerName)}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
    content: new Uint8Array(doc.output("arraybuffer")),
    contentType: "application/pdf",
  };
}

function extensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "bin";
}

function fileNameFromUrl(url: string, fallbackBase: string, contentType = "") {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() || "";
    if (last.includes(".")) return last;
  } catch {
    // Fall through to generated file name.
  }
  return `${fallbackBase}.${extensionFromContentType(contentType)}`;
}

async function fetchUrlAttachment(url: string, fallbackBase: string): Promise<EmailAttachment | null> {
  const target = normalizeText(url);
  if (!target) return null;
  try {
    const response = await fetch(target);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return null;
    const contentType = normalizeText(response.headers.get("content-type")) || "application/octet-stream";
    const filename = fileNameFromUrl(target, fallbackBase, contentType);
    return { filename, content: bytes, contentType };
  } catch {
    return null;
  }
}

async function expandLeadFamilyIds(supabase: any, seedLeadIds: string[]) {
  const relatedLeadFamilyIds = new Set<string>(seedLeadIds.filter(Boolean));
  if (seedLeadIds.length === 0) return Array.from(relatedLeadFamilyIds);

  const [relatedByIdResult, relatedByEstimateJobIdResult] = await Promise.all([
    supabase.from("leads").select("id, estimate_job_id").in("id", seedLeadIds),
    supabase.from("leads").select("id, estimate_job_id").in("estimate_job_id", seedLeadIds),
  ]);

  const relatedLeadRows = [
    ...(relatedByIdResult.data || []),
    ...(relatedByEstimateJobIdResult.data || []),
  ];
  for (const row of relatedLeadRows) {
    const id = String((row as any)?.id || "");
    const estimateJobId = String((row as any)?.estimate_job_id || "");
    if (id) relatedLeadFamilyIds.add(id);
    if (estimateJobId) relatedLeadFamilyIds.add(estimateJobId);
  }
  return Array.from(relatedLeadFamilyIds);
}

function buildCustomerHtml(companyName: string, customerName: string, total: number, jobName: string, eventType: "estimate_approved" | "change_order_approved") {
  const label = eventType === "change_order_approved" ? "change order" : "estimate";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif"><p>Hi ${escapeHtml(customerName)},</p><p>Thanks for approving your ${label} for <strong>${escapeHtml(jobName)}</strong>.</p><p>Approved total: <strong>$${Number(total || 0).toFixed(2)}</strong></p><p>${escapeHtml(companyName)} will follow up with next steps.</p></body></html>`;
}

function buildUserHtml(companyName: string, userName: string, customerName: string, total: number, jobName: string, eventType: "estimate_approved" | "change_order_approved") {
  const label = eventType === "change_order_approved" ? "change order" : "estimate";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif"><p>Hi ${escapeHtml(userName || "there")},</p><p>${escapeHtml(customerName)} approved the ${label} for <strong>${escapeHtml(jobName)}</strong>.</p><p>Approved total: <strong>$${Number(total || 0).toFixed(2)}</strong></p><p>${escapeHtml(companyName)}</p></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const estimateId = body.estimate_id?.trim();
    if (!estimateId) return json({ error: "estimate_id is required" }, 400);

    const eventType = body.event_type === "change_order_approved" ? "change_order_approved" : "estimate_approved";
    const forceResend = body.force_resend === true;

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpSecure = (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPass = Deno.env.get("SMTP_PASS")?.replace(/\s+/gu, "");
    const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "";

    if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) return json({ error: "SMTP not configured" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select(`id,account_id,customer_id,job_id,status,total,subtotal,tax_rate,tax,discount,notes,accepted_at,manual_approval_photo_url,agreement_templates,agreement_acceptance,customer:customers(name,email,phone),job:leads!estimates_job_id_fkey(name,address,city,service_type),line_items:estimate_line_items(name,description,quantity,unit,unit_price,total,sort_order,is_change_order,change_order_type)`)
      .eq("id", estimateId)
      .maybeSingle();

    if (estimateError || !estimate) return json({ error: "Estimate not found" }, 404);
    if (estimate.status !== "accepted") return json({ success: true, skipped: true, reason: "Estimate not accepted" });

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name,company_email,settings,pricing_plan")
      .eq("id", estimate.account_id)
      .maybeSingle();

    if (account?.pricing_plan === "free") return json({ success: true, skipped: true, reason: "Notifications are not available on the Free plan" });
    if ((account?.settings as any)?.job_message_automation?.payment_emails?.estimate_approved === false) {
      return json({ success: true, skipped: true, reason: "Estimate approved emails disabled" });
    }

    const companyName = normalizeText(account?.company_name) || "LeadSig";
    const customerName = normalizeText((estimate as any)?.customer?.name) || "there";
    const customerEmail = normalizeText((estimate as any)?.customer?.email);
    const customerPhone = normalizeText((estimate as any)?.customer?.phone);
    const jobName = normalizeText((estimate as any)?.job?.name) || "your project";

    const attachments: EmailAttachment[] = [
      buildEstimatePdf({
        eventType,
        companyName,
        customerName,
        jobName,
        address: [normalizeText((estimate as any)?.job?.address), normalizeText((estimate as any)?.job?.city)].filter(Boolean).join(", "),
        subtotal: Number((estimate as any)?.subtotal || 0),
        taxRate: Number((estimate as any)?.tax_rate || 0),
        tax: Number((estimate as any)?.tax || 0),
        discount: Number((estimate as any)?.discount || 0),
        total: Number((estimate as any)?.total || 0),
        notes: normalizeText((estimate as any)?.notes),
        lineItems: ((estimate as any)?.line_items || []) as any[],
      }),
    ];

    const approvalSignatureUrl = normalizeText((estimate as any)?.manual_approval_photo_url);

    if (eventType !== "change_order_approved") {
      const mergeFields: Record<string, string> = {
        current_date: format(new Date(), "yyyy-MM-dd"),
        job_name: jobName,
        job_address: [normalizeText((estimate as any)?.job?.address), normalizeText((estimate as any)?.job?.city)].filter(Boolean).join(", "),
        service_type: normalizeText((estimate as any)?.job?.service_type),
        client_name: customerName,
        client_email: customerEmail,
        client_phone: customerPhone,
        company_name: companyName,
        company_email: normalizeText(account?.company_email),
        estimate_total: `$${Number((estimate as any)?.total || 0).toFixed(2)}`,
        estimate_subtotal: `$${Number((estimate as any)?.subtotal || 0).toFixed(2)}`,
        estimate_tax: `$${Number((estimate as any)?.tax || 0).toFixed(2)}`,
        estimate_discount: `$${Number((estimate as any)?.discount || 0).toFixed(2)}`,
      };

      const agreementTemplates = ((estimate as any)?.agreement_templates && typeof (estimate as any)?.agreement_templates === "object")
        ? ((estimate as any).agreement_templates as Record<string, unknown>)
        : {};

      if (estimate.job_id) {
        try {
          const leadIds = await expandLeadFamilyIds(supabase, [String(estimate.job_id)]);
          const { data: configs } = await supabase
            .from("job_document_configs")
            .select("id,lead_id,template_id,include_in_job,email_timing,requires_signature,template:document_templates(name,system_key,body)")
            .in("lead_id", leadIds)
            .order("sort_order", { ascending: true });

          const rows = (configs || []) as JobDocumentConfig[];
          if (rows.length > 0) {
            const requiredRows = rows.filter(
              (row) => row.include_in_job === true && normalizeTiming(row.email_timing || "never") === "on_estimate_approval",
            );
            const jobDocuments = await loadJobDocuments(supabase, leadIds);

            // Single source of truth: required configs drive attachments.
            // For each required config, prefer its exact uploaded document by config_id.
            // If missing/unreadable, generate fallback from the config template body.
            for (const row of requiredRows) {
              const rowId = String(row.id || "");
              if (!rowId) continue;

              const uploaded = jobDocuments.find((doc) => String(doc.config_id || "") === rowId) || null;
              let attachedFromUpload = false;

              if (uploaded) {
                const path = normalizeText(uploaded.file_path);
                if (path) {
                  const { data } = supabase.storage.from("job-documents").getPublicUrl(path);
                  const attachment = await fetchUrlAttachment(
                    data?.publicUrl || "",
                    sanitizeFilePart(uploaded.file_name || "document"),
                  );
                  if (attachment) {
                    attachment.filename = normalizeText(uploaded.file_name) || attachment.filename;
                    attachment.contentType = normalizeText(uploaded.mime_type) || attachment.contentType;
                    attachments.push(attachment);
                    attachedFromUpload = true;
                  }
                }
              }

              if (attachedFromUpload) continue;

              const t = row.template;
              const title = normalizeText(t?.name) || "Document";
              const bodyText = renderTemplate(resolveTemplateBody(t, agreementTemplates), mergeFields);
              if (!bodyText) continue;
              attachments.push(
                await buildSignedTemplatePdf({
                  title,
                  body: bodyText,
                  customerName,
                  prefix: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document",
                  includeSignatureSection: row.requires_signature === true,
                  signatureImageUrl: approvalSignatureUrl,
                  signatureDateIso: normalizeText((estimate as any)?.accepted_at),
                }),
              );
            }
          }
        } catch (attachmentError) {
          const message = attachmentError instanceof Error ? attachmentError.message : "Unknown attachment assembly error";
          console.error("Attachment assembly failed; continuing with available attachments:", message);
          await supabase.from("estimate_email_notifications_log").insert({
            estimate_id: estimate.id,
            account_id: estimate.account_id,
            event_type: eventType,
            recipient_email: null,
            recipient_type: "user",
            status: "failed",
            error_message: `Attachment assembly failed: ${message}`,
          });
        }
      }

    }

    const filteredAttachments = attachments.filter((a) => !a.filename.startsWith("job-release-"));

    const recipients: Array<{ email: string; name: string; recipientType: RecipientType }> = [];
    const recipientKeys = new Set<string>();
    const addRecipient = (emailRaw: string, name: string, recipientType: RecipientType) => {
      const email = normalizeText(emailRaw).toLowerCase();
      if (!email) return;
      const key = `${recipientType}:${email}`;
      if (recipientKeys.has(key)) return;
      recipientKeys.add(key);
      recipients.push({ email, name, recipientType });
    };

    if (customerEmail) {
      addRecipient(customerEmail, customerName, "customer");
    } else {
      await supabase.from("estimate_email_notifications_log").insert({
        estimate_id: estimate.id,
        account_id: estimate.account_id,
        event_type: eventType,
        recipient_email: null,
        recipient_type: "customer",
        status: "failed",
        error_message: "Customer email is missing; could not send estimate approval email.",
      });
    }

    const companyEmail = normalizeText(account?.company_email);
    if (companyEmail) {
      addRecipient(companyEmail, companyName, "user");
    }

    if (recipients.length === 0) {
      return json({
        success: true,
        sent: 0,
        skipped: 1,
        errors: [{ email: "", error: "No eligible recipients found (missing customer and company emails)." }],
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    let sent = 0;
    let skipped = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      void forceResend;

      const subject = recipient.recipientType === "customer"
        ? `${companyName} | ${eventType === "change_order_approved" ? "Change Order Approved" : "Estimate Approved"}`
        : `${companyName} | ${eventType === "change_order_approved" ? "Change Order Approved" : "Estimate Approved"} by ${customerName}`;

      const html = recipient.recipientType === "customer"
        ? buildCustomerHtml(companyName, customerName, Number((estimate as any)?.total || 0), jobName, eventType)
        : buildUserHtml(companyName, recipient.name, customerName, Number((estimate as any)?.total || 0), jobName, eventType);

      const text = `${recipient.recipientType === "customer" ? `Hi ${customerName}` : `Hi ${recipient.name}`},\n\n${customerName} approved the ${eventType === "change_order_approved" ? "change order" : "estimate"} for ${jobName}.\nApproved total: $${Number((estimate as any)?.total || 0).toFixed(2)}`;

      try {
        await transporter.sendMail({
          from: smtpFrom,
          to: [recipient.email],
          replyTo: normalizeText(account?.company_email) || undefined,
          subject,
          html,
          text,
          attachments: filteredAttachments,
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

    return json({ success: true, sent, skipped, errors });
  } catch (error) {
    console.error("send-estimate-approval-notifications error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
