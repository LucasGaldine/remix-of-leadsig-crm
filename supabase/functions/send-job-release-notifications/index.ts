import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import { jsPDF as JsPDF } from "npm:jspdf@2.5.2";
import { format } from "npm:date-fns@3.6.0";

type JsPdfDoc = InstanceType<typeof JsPDF>;

type RequestBody = {
  job_release_id?: string;
  event_type?: "request_signature" | "signed_copy";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRequestSignatureHtml(params: { companyName: string; customerName: string; jobName: string; portalUrl: string }) {
  const companyName = escapeHtml(params.companyName);
  const customerName = escapeHtml(params.customerName);
  const jobName = escapeHtml(params.jobName);
  const portalUrl = escapeHtml(params.portalUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${companyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Job Release Required</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${customerName},</p>
          <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">
            Your project <strong>${jobName}</strong> is complete and fully paid. Please sign your Job Release Agreement to close out the job.
          </p>
          <p style="margin:16px 0;">
            <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:600;">Review & Sign Job Release</a>
          </p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:<br/>${portalUrl}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildSignedCopyHtml(params: { companyName: string; recipientName: string; jobName: string; customerName: string; isCustomer: boolean }) {
  const companyName = escapeHtml(params.companyName);
  const recipientName = escapeHtml(params.recipientName || "there");
  const jobName = escapeHtml(params.jobName);
  const customerName = escapeHtml(params.customerName);
  const description = params.isCustomer
    ? `Your signed Job Release for <strong>${jobName}</strong> is attached for your records.`
    : `${customerName} signed the Job Release for <strong>${jobName}</strong>. A copy is attached.`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px 24px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${companyName}</h1>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Signed Job Release</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.5;">Hi ${recipientName},</p>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">${description}</p>
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

function addWrappedText(doc: JsPdfDoc, text: string, margin: number, yPosition: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  const lines = doc.splitTextToSize(text, maxWidth);
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(line, margin, yPosition);
    yPosition += 5;
  }

  return yPosition;
}

async function buildJobReleasePdf(params: {
  companyName: string;
  customerName: string;
  jobName: string;
  releaseText: string;
  signedAt: string | null;
  signatureImageUrl: string | null;
}) {
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 16;
  let yPosition = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Signed Job Release", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, margin, yPosition);
  yPosition += 8;
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(10);
  yPosition = addWrappedText(doc, `Company: ${params.companyName}`, margin, yPosition);
  yPosition = addWrappedText(doc, `Client: ${params.customerName}`, margin, yPosition);
  yPosition = addWrappedText(doc, `Project: ${params.jobName}`, margin, yPosition);
  if (params.signedAt) {
    yPosition = addWrappedText(doc, `Signed at: ${format(new Date(params.signedAt), "MMMM d, yyyy h:mm a")}`, margin, yPosition);
  }

  yPosition += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Agreement Text", margin, yPosition);
  yPosition += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yPosition = addWrappedText(doc, params.releaseText, margin, yPosition);

  if (params.signatureImageUrl) {
    try {
      const signatureDataUrl = await getImageDataUrl(params.signatureImageUrl);
      if (yPosition > 220) {
        doc.addPage();
        yPosition = margin;
      }
      yPosition += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Client Signature", margin, yPosition);
      yPosition += 4;
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, yPosition, 80, 28);
      doc.addImage(signatureDataUrl, "PNG", margin + 2, yPosition + 2, 76, 24);
    } catch {
      // Skip signature image if unavailable
    }
  }

  const output = doc.output("arraybuffer");
  return new Uint8Array(output);
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
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const jobReleaseId = body.job_release_id;
    const eventType = body.event_type === "signed_copy" ? "signed_copy" : "request_signature";

    if (!jobReleaseId) {
      return new Response(JSON.stringify({ error: "Missing job_release_id" }), {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: jobRelease, error: releaseError } = await supabase
      .from("job_releases")
      .select(`
        id,
        lead_id,
        account_id,
        customer_id,
        status,
        release_text,
        signed_at,
        signature_image_url,
        request_email_sent_at,
        signed_copy_email_sent_at,
        lead:leads!job_releases_lead_id_fkey(id, name, customer_id),
        customer:customers!job_releases_customer_id_fkey(id, name, email, client_portal_token),
        account:accounts!job_releases_account_id_fkey(id, company_name, company_email, settings)
      `)
      .eq("id", jobReleaseId)
      .maybeSingle();

    if (releaseError || !jobRelease) {
      return new Response(JSON.stringify({ error: "Job release not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSettings = (jobRelease as any).account?.settings ?? {};
    const paymentEmails = (accountSettings?.job_message_automation?.payment_emails ?? {}) as Record<string, unknown>;

    if (eventType === "request_signature" && paymentEmails.job_release_request_email === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Job release request emails disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "signed_copy" && paymentEmails.job_release_signed_copy_email === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Job release signed-copy emails disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = (jobRelease as any).account?.company_name?.trim() || "LeadSig";
    const customerName = (jobRelease as any).customer?.name?.trim() || "there";
    const customerEmail = (jobRelease as any).customer?.email?.trim() || "";
    const jobName = (jobRelease as any).lead?.name?.trim() || "your project";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    if (eventType === "request_signature") {
      if ((jobRelease as any).request_email_sent_at) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Already sent" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!customerEmail) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Customer email missing" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerPortalToken = (jobRelease as any).customer?.client_portal_token || "";
      if (!customerPortalToken) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Portal token missing" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const portalUrl = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".supabase.co")}`;
      const appUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "";
      const signUrl = `${appUrl}/portal?token=${encodeURIComponent(customerPortalToken)}&jobId=${encodeURIComponent(String((jobRelease as any).lead_id || ""))}`;

      await transporter.sendMail({
        from: smtpFrom,
        to: [customerEmail],
        replyTo: (jobRelease as any).account?.company_email || undefined,
        subject: `${companyName} | Please sign your Job Release`,
        html: buildRequestSignatureHtml({ companyName, customerName, jobName, portalUrl: signUrl || portalUrl }),
      });

      await supabase
        .from("job_releases")
        .update({ request_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", jobReleaseId)
        .is("request_email_sent_at", null);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((jobRelease as any).status !== "signed" || !(jobRelease as any).signed_at) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Not signed yet" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((jobRelease as any).signed_copy_email_sent_at) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Already sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdf = await buildJobReleasePdf({
      companyName,
      customerName,
      jobName,
      releaseText: String((jobRelease as any).release_text || ""),
      signedAt: (jobRelease as any).signed_at || null,
      signatureImageUrl: (jobRelease as any).signature_image_url || null,
    });

    const recipients: Array<{ email: string; name: string; isCustomer: boolean }> = [];
    if (customerEmail) {
      recipients.push({ email: customerEmail, name: customerName, isCustomer: true });
    }

    const { data: members } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", (jobRelease as any).account_id)
      .eq("is_active", true);

    const memberUserIds = (members || []).map((member: any) => member.user_id).filter(Boolean);
    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("user_id", memberUserIds);

      for (const profile of profiles || []) {
        const email = String((profile as any).email || "").trim();
        if (!email) continue;
        recipients.push({ email, name: String((profile as any).full_name || "there"), isCustomer: false });
      }
    }

    const uniqueRecipients = new Map<string, { email: string; name: string; isCustomer: boolean }>();
    for (const recipient of recipients) {
      const key = recipient.email.toLowerCase();
      if (!uniqueRecipients.has(key)) {
        uniqueRecipients.set(key, recipient);
      }
    }

    for (const recipient of uniqueRecipients.values()) {
      await transporter.sendMail({
        from: smtpFrom,
        to: [recipient.email],
        replyTo: (jobRelease as any).account?.company_email || undefined,
        subject: recipient.isCustomer
          ? `${companyName} | Signed Job Release Copy`
          : `${companyName} | Job Release Signed by ${customerName}`,
        html: buildSignedCopyHtml({
          companyName,
          recipientName: recipient.name,
          jobName,
          customerName,
          isCustomer: recipient.isCustomer,
        }),
        attachments: [
          {
            filename: `job-release-${String((jobRelease as any).lead_id || "job")}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
    }

    await supabase
      .from("job_releases")
      .update({ signed_copy_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobReleaseId)
      .is("signed_copy_email_sent_at", null);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-job-release-notifications error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
