import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSignedCopyRecipients,
  normalizeText,
  sendSignedCopyEmails,
} from "../_shared/signed-copy.ts";
import {
  persistSignedJobDocumentPdfs,
  resolveDocumentTemplateMergeFields,
  resolveUploadedDocumentForConfig,
} from "./signed-documents.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SIGNATURE_IMAGE_BYTES = 6 * 1024 * 1024;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeTiming(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseSignatureDataUrl(signatureDataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } | null {
  const trimmed = signatureDataUrl.trim();
  const match = trimmed.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;

  const contentType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const extensionByContentType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const extension = extensionByContentType[contentType];
  if (!extension) return null;

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(match[2]);
  } catch {
    return null;
  }
  if (!bytes.length || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) return null;

  return { bytes, contentType, extension };
}

async function uploadSignatureDataUrl(
  supabase: any,
  estimateId: string,
  signatureDataUrl: string,
): Promise<{ ok: true; filePath: string; publicUrl: string } | { ok: false; error: string; statusCode: number }> {
  const parsed = parseSignatureDataUrl(signatureDataUrl);
  if (!parsed) return { ok: false, error: "Invalid signature format. Please sign again.", statusCode: 400 };

  const filePath = `estimate-approvals/${estimateId}/${crypto.randomUUID()}.${parsed.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("lead-photos")
    .upload(filePath, parsed.bytes, { contentType: parsed.contentType, upsert: false });

  if (uploadError) return { ok: false, error: "Failed to upload signature image", statusCode: 500 };
  const { data: urlData } = supabase.storage.from("lead-photos").getPublicUrl(filePath);
  return { ok: true, filePath, publicUrl: urlData.publicUrl };
}

async function expandLeadFamilyIds(supabase: any, seedLeadIds: string[]): Promise<string[]> {
  const known = new Set(seedLeadIds.filter(Boolean));
  const queue = Array.from(known);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const batch = queue.splice(0, 50).filter((id) => !visited.has(id));
    if (batch.length === 0) continue;
    for (const id of batch) visited.add(id);

    const [byId, byEstimateId] = await Promise.all([
      supabase.from("leads").select("id, estimate_job_id").in("id", batch),
      supabase.from("leads").select("id, estimate_job_id").in("estimate_job_id", batch),
    ]);

    for (const row of [...(byId.data || []), ...(byEstimateId.data || [])]) {
      const id = String((row as any)?.id || "");
      const estimateId = String((row as any)?.estimate_job_id || "");
      for (const candidate of [id, estimateId]) {
        if (!candidate || known.has(candidate)) continue;
        known.add(candidate);
        queue.push(candidate);
      }
    }
  }

  return Array.from(known);
}

async function fetchPortalDocumentsForLeadFamily(
  supabase: any,
  supabaseUrl: string,
  seedLeadIds: string[],
): Promise<{ leadIds: string[]; leadId: string | null; configs: any[]; documents: any[] }> {
  const leadIds = await expandLeadFamilyIds(supabase, seedLeadIds);
  if (leadIds.length === 0) return { leadIds, leadId: null, configs: [], documents: [] };

  const readConfigs = async () =>
    supabase
      .from("job_document_configs")
      .select("id, lead_id, template_id, include_in_job, email_timing, requires_signature, sort_order, template:document_templates(id, name, system_key, body)")
      .in("lead_id", leadIds)
      .order("sort_order", { ascending: true });

  let { data: configRows, error: configError } = await readConfigs();

  if (!configError) {
    const defaultLeadId = seedLeadIds.find(Boolean) || leadIds[0] || null;
    if (defaultLeadId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("id, account_id")
        .eq("id", defaultLeadId)
        .maybeSingle();

      const accountId = String(leadRow?.account_id || "");
      if (accountId) {
        const { data: templateRows, error: templateError } = await supabase
          .from("document_templates")
          .select("id, default_email_timing, default_requires_signature")
          .eq("account_id", accountId)
          .eq("default_included_in_jobs", true)
          .order("created_at", { ascending: true });

        if (!templateError) {
          const existingTemplateIds = new Set(
            ((configRows || []) as any[])
              .map((row) => String((row as any)?.template_id || ""))
              .filter(Boolean),
          );

          const templatesToInsert = (templateRows || [])
            .map((row: any) => ({
              id: String(row?.id || ""),
              default_email_timing: String(row?.default_email_timing || "never"),
              default_requires_signature: row?.default_requires_signature === true,
            }))
            .filter((row: { id: string }) => row.id.length > 0 && !existingTemplateIds.has(row.id));

          if (templatesToInsert.length > 0) {
            const insertPayload = templatesToInsert.map((template: {
              id: string;
              default_email_timing: string;
              default_requires_signature: boolean;
            }, index: number) => ({
              lead_id: defaultLeadId,
              account_id: accountId,
              template_id: template.id,
              include_in_job: true,
              email_timing: template.default_email_timing,
              requires_signature: template.default_requires_signature,
              sort_order: (configRows || []).length + index,
              created_by: null,
            }));

            const { error: seedError } = await supabase
              .from("job_document_configs")
              .insert(insertPayload);

            if (!seedError) {
              const refreshed = await readConfigs();
              configRows = refreshed.data;
              configError = refreshed.error;
            }
          }
        }
      }
    }
  }

  let configs: any[] = [];
  if (!configError) {
    const leadPriority = new Map(leadIds.map((id, index) => [id, index]));
    configs = (configRows || [])
      .map((row: any) => {
        const templateRaw = row?.template;
        const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
        return {
          id: String(row?.id || ""),
          lead_id: String(row?.lead_id || ""),
          template_id: String(row?.template_id || ""),
          include_in_job: row?.include_in_job === true,
          email_timing: String(row?.email_timing || "never"),
          requires_signature: row?.requires_signature === true,
          sort_order: Number(row?.sort_order || 0),
          template: template
            ? {
                id: String(template.id || ""),
                name: String(template.name || ""),
                system_key: template.system_key ? String(template.system_key) : null,
                body: typeof template.body === "string" ? template.body : null,
              }
            : null,
        };
      })
      .filter((cfg: any) => cfg.id && cfg.lead_id)
      .sort((a: any, b: any) => {
        const ap = leadPriority.get(a.lead_id) ?? Number.MAX_SAFE_INTEGER;
        const bp = leadPriority.get(b.lead_id) ?? Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      });
  }

  const { data: documentRows } = await supabase
    .from("job_documents")
    .select("id, lead_id, template_id, config_id, document_key, file_name, file_path, mime_type, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  let documents = (documentRows || [])
    .map((row: any) => ({
      id: String(row?.id || ""),
      lead_id: String(row?.lead_id || ""),
      template_id: row?.template_id ? String(row.template_id) : null,
      config_id: row?.config_id ? String(row.config_id) : null,
      document_key: String(row?.document_key || ""),
      file_name: String(row?.file_name || ""),
      file_path: String(row?.file_path || ""),
      mime_type: row?.mime_type ? String(row.mime_type) : null,
      created_at: String(row?.created_at || ""),
      url: `${supabaseUrl}/storage/v1/object/public/job-documents/${row.file_path}`,
    }))
    .filter((doc: any) => doc.id && doc.file_path);

  if (configs.length === 0 && documents.length > 0) {
    const templateIds = Array.from(new Set(documents.map((doc: any) => String(doc.template_id || "")).filter(Boolean)));
    const templateById = new Map<string, any>();

    if (templateIds.length > 0) {
      const { data: templateRows } = await supabase
        .from("document_templates")
        .select("id, name, system_key, body")
        .in("id", templateIds);
      for (const row of templateRows || []) {
        const id = String((row as any)?.id || "");
        if (!id) continue;
        templateById.set(id, row);
      }
    }

    const synthetic = new Map<string, any>();
    for (let i = 0; i < documents.length; i += 1) {
      const document = documents[i];
      const templateId = String(document.template_id || "");
      const key = templateId || `legacy:${String(document.document_key || document.id)}`;
      if (synthetic.has(key)) continue;

      const template = templateId ? templateById.get(templateId) : null;
      synthetic.set(key, {
        id: `virtual:${key}`,
        lead_id: String(document.lead_id || leadIds[0] || ""),
        template_id: templateId,
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        sort_order: i,
        template: template
          ? {
              id: String(template.id || ""),
              name: String(template.name || "Document"),
              system_key: template.system_key ? String(template.system_key) : null,
              body: typeof template.body === "string" ? template.body : null,
            }
          : {
              id: templateId,
              name: String(document.file_name || "Document"),
              system_key: null,
              body: null,
            },
      });
    }

    configs = Array.from(synthetic.values());
  }

  const configIds = new Set(configs.map((cfg: any) => cfg.id));
  const templateIds = new Set(configs.map((cfg: any) => cfg.template_id).filter(Boolean));
  documents = documents.filter((doc: any) => {
    if (doc.config_id && configIds.has(doc.config_id)) return true;
    if (configIds.size === 0) return true;
    if (doc.template_id && templateIds.has(doc.template_id)) return true;
    return leadIds.includes(doc.lead_id);
  });

  return { leadIds, leadId: leadIds[0] || null, configs, documents };
}

async function sendSignedManualDocumentEmails(params: {
  customer: any;
  account: any;
  signatureUrl: string;
  portalLink: string;
  documentSummaries: Array<{ name: string; url: string }>;
  attachments: Array<{ filename: string; content: Uint8Array; contentType?: string }>;
}) {
  const { customer, account, signatureUrl, portalLink, documentSummaries, attachments } = params;
  const customerId = normalizeText(customer?.id);
  const accountId = normalizeText(account?.id);
  if (!customerId || !accountId) return { ok: false, error: "Missing customer/account." };
  if (!signatureUrl || !portalLink || documentSummaries.length === 0) {
    return { ok: false, error: "Missing signed-document email fields." };
  }

  const customerName = normalizeText(customer?.name) || "Customer";
  const companyName = normalizeText(account?.company_name) || "LeadSig";
  const recipients = buildSignedCopyRecipients({
    customerEmail: normalizeText(customer?.email),
    customerName,
    companyEmail: normalizeText(account?.company_email),
    companyName,
    profileEmails: [],
  });

  if (recipients.length === 0) return { ok: false, error: "No recipients." };

  const result = await sendSignedCopyEmails({
    recipients,
    attachments,
    companyName,
    customerName,
    portalLink,
    signatureUrl,
    documentSummaries,
    replyTo: normalizeText(account?.company_email) || undefined,
  });

  if (!result.ok) return { ok: false, error: result.error };
  const normalizedCustomerEmail = normalizeText(customer?.email).toLowerCase();
  const customerFailed = normalizedCustomerEmail
    ? result.failed.some((entry) => normalizeText(entry.email).toLowerCase() === normalizedCustomerEmail)
    : true;
  if (customerFailed) {
    return { ok: false, error: "Signed copy could not be delivered to the client email address." };
  }
  if (result.failed.length > 0) {
    console.error("Some signed-copy recipients failed", { failed: result.failed });
  }
  return { ok: true };
}

async function getEstimateForPortalJob(supabase: any, job: any) {
  const estimateSelect = `
    id, job_id, account_id, customer_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status,
    created_at, updated_at, accepted_at, approved_via, manual_approval_photo_url,
    original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
    proposal_settings, project_visualization_image_url, agreement_acceptance,
    line_items:estimate_line_items(
      id, name, description, quantity, unit, unit_price, total,
      sort_order, is_change_order, change_order_type, change_order_approved, changed_at
    )
  `;

  const { data: estimate } = await supabase
    .from("estimates")
    .select(estimateSelect)
    .eq("job_id", job.id)
    .maybeSingle();

  if (estimate) return { estimate, effectiveLeadId: String(job.id) };

  const parentLeadId = String(job?.estimate_job_id || "");
  if (!parentLeadId) return { estimate: null, effectiveLeadId: String(job.id) };

  const { data: parentEstimate } = await supabase
    .from("estimates")
    .select(estimateSelect)
    .eq("job_id", parentLeadId)
    .maybeSingle();

  return { estimate: parentEstimate || null, effectiveLeadId: parentLeadId || String(job.id) };
}

function companyPayload(account: any) {
  return {
    company_name: String(account?.company_name || ""),
    company_email: String(account?.company_email || ""),
    company_phone: String(account?.company_phone || ""),
    logo_url: account?.logo_url || null,
    portal_color: account?.settings?.client_portal_color ?? null,
    portal_text_color: account?.settings?.client_portal_text_color ?? null,
    client_portal_color: account?.settings?.client_portal_color ?? null,
    client_portal_text_color: account?.settings?.client_portal_text_color ?? null,
    settings: account?.settings ?? null,
  };
}

async function handleGetPortalList(supabase: any, customer: any) {
  const [{ data: jobs }, { data: recurringJobs }, { data: invoices }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, address, service_type, status, created_at, updated_at, is_estimate_visit, estimate_job_id, account_id")
      .eq("customer_id", customer.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_jobs")
      .select("id, name, address, service_type, frequency, start_date, end_date, created_at, account_id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, lead_id, stripe_invoice_url, status, total, created_at, leads!inner(customer_id, name, service_type)")
      .eq("leads.customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);

  const resolvedAccountId =
    (typeof customer.account_id === "string" && customer.account_id) ||
    (jobs || []).map((job: any) => (typeof job?.account_id === "string" ? job.account_id : "")).find(Boolean) ||
    (recurringJobs || [])
      .map((recurringJob: any) => (typeof recurringJob?.account_id === "string" ? recurringJob.account_id : ""))
      .find(Boolean) ||
    null;

  const { data: account } = resolvedAccountId
    ? await supabase
        .from("accounts")
        .select("company_name, company_email, company_phone, logo_url, settings")
        .eq("id", resolvedAccountId)
        .maybeSingle()
    : { data: null };

  const regularJobs = (jobs || []).filter((j: any) => !j.is_estimate_visit);
  const estimateVisitJobs = (jobs || []).filter((j: any) => j.is_estimate_visit && !j.estimate_job_id);
  const displayJobs = regularJobs.length > 0 ? regularJobs : estimateVisitJobs;

  const displayJobIds = displayJobs.map((job: any) => String(job?.id || "")).filter(Boolean);
  const jobScheduleBounds = new Map<string, { startDate: string; endDate: string }>();
  if (displayJobIds.length > 0) {
    const { data: schedules } = await supabase
      .from("job_schedules")
      .select("lead_id, scheduled_date")
      .in("lead_id", displayJobIds);

    for (const schedule of schedules || []) {
      const leadId = String((schedule as any)?.lead_id || "");
      const date = String((schedule as any)?.scheduled_date || "");
      if (!leadId || !date) continue;
      const existing = jobScheduleBounds.get(leadId);
      if (!existing) {
        jobScheduleBounds.set(leadId, { startDate: date, endDate: date });
        continue;
      }
      if (date < existing.startDate) existing.startDate = date;
      if (date > existing.endDate) existing.endDate = date;
    }
  }

  const leadFamilyIds = Array.from(
    new Set(
      displayJobs.flatMap((job: any) => [String(job?.id || ""), String(job?.estimate_job_id || "")].filter(Boolean)),
    ),
  );

  let requiredDocuments: Array<{ id: string; job_id: string; job_name: string; title: string }> = [];
  if (leadFamilyIds.length > 0) {
    const [{ data: estimates }, { data: configRows }] = await Promise.all([
      supabase
        .from("estimates")
        .select("job_id, agreement_acceptance")
        .in("job_id", leadFamilyIds),
      supabase
        .from("job_document_configs")
        .select("id, lead_id, include_in_job, requires_signature, template:document_templates(name)")
        .in("lead_id", leadFamilyIds)
        .eq("include_in_job", true)
        .eq("requires_signature", true),
    ]);

    const estimateByLeadId = new Map<string, any>();
    for (const estimate of estimates || []) {
      const leadId = String((estimate as any)?.job_id || "");
      if (!leadId || estimateByLeadId.has(leadId)) continue;
      estimateByLeadId.set(leadId, estimate);
    }

    const relatedDisplayJobByLeadId = new Map<string, any>();
    for (const job of displayJobs) {
      const childId = String(job?.id || "");
      const parentId = String(job?.estimate_job_id || "");
      if (childId && !relatedDisplayJobByLeadId.has(childId)) relatedDisplayJobByLeadId.set(childId, job);
      if (parentId && !relatedDisplayJobByLeadId.has(parentId)) relatedDisplayJobByLeadId.set(parentId, job);
    }

    const pendingDocs: Array<{ id: string; job_id: string; job_name: string; title: string }> = [];
    for (const config of configRows || []) {
      const configId = String((config as any)?.id || "");
      const leadId = String((config as any)?.lead_id || "");
      if (!configId || !leadId) continue;

      const estimate = estimateByLeadId.get(leadId);
      if (!estimate) continue;

      const acceptance =
        estimate?.agreement_acceptance && typeof estimate.agreement_acceptance === "object"
          ? estimate.agreement_acceptance
          : {};
      const alreadyAccepted = acceptance?.[configId] === true;
      if (alreadyAccepted) continue;

      const relatedJob = relatedDisplayJobByLeadId.get(leadId);
      if (!relatedJob) continue;

      const templateRaw = (config as any)?.template;
      const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;

      pendingDocs.push({
        id: configId,
        job_id: String(relatedJob.id || ""),
        job_name: String(relatedJob.name || "Job"),
        title: String(template?.name || "Document"),
      });
    }

    requiredDocuments = Array.from(new Map(pendingDocs.map((doc) => [doc.id, doc])).values());
  }

  return jsonResponse({
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    company: companyPayload(account),
    jobs: displayJobs.map((j: any) => ({
      id: j.id,
      name: j.name,
      address: j.address,
      service_type: j.service_type,
      status: j.status,
      created_at: j.created_at,
      schedule_start_date: jobScheduleBounds.get(String(j.id || ""))?.startDate,
      schedule_end_date: jobScheduleBounds.get(String(j.id || ""))?.endDate,
    })),
    recurring_jobs: (recurringJobs || []).map((rj: any) => ({
      id: rj.id,
      name: rj.name,
      address: rj.address,
      service_type: rj.service_type,
      frequency: rj.frequency,
      start_date: rj.start_date,
      end_date: rj.end_date,
      created_at: rj.created_at,
    })),
    invoices: (invoices || []).map((inv: any) => ({
      id: inv.id,
      lead_id: inv.lead_id,
      job_name: inv.leads?.name,
      service_type: inv.leads?.service_type,
      stripe_invoice_url: inv.stripe_invoice_url,
      status: inv.status,
      total: inv.total,
      created_at: inv.created_at,
    })),
    required_documents: requiredDocuments,
  });
}

async function handleGetJobDetail(supabase: any, supabaseUrl: string, customer: any, jobId: string) {
  const { data: job } = await supabase
    .from("leads")
    .select("id, name, address, service_type, status, description, created_at, estimate_job_id, account_id, customer_id")
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!job) return jsonResponse({ error: "Job not found or access denied" }, 404);

  const resolvedAccountId =
    (typeof job.account_id === "string" && job.account_id) ||
    (typeof customer.account_id === "string" && customer.account_id) ||
    null;

  const [{ data: account }, { data: schedules }, { data: beforePhotos }, { data: afterPhotos }, { data: interactions }, { data: invoice }] = await Promise.all([
    resolvedAccountId
      ? supabase
          .from("accounts")
          .select("company_name, company_email, company_phone, logo_url, settings")
          .eq("id", resolvedAccountId)
          .maybeSingle()
      : { data: null },
    supabase
      .from("job_schedules")
      .select("id, scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
      .eq("lead_id", job.id)
      .order("scheduled_date", { ascending: true }),
    supabase
      .from("lead_photos")
      .select("id, file_path, created_at")
      .eq("lead_id", job.id)
      .eq("photo_type", "before")
      .order("created_at", { ascending: true }),
    supabase
      .from("lead_photos")
      .select("id, file_path, created_at")
      .eq("lead_id", job.id)
      .eq("photo_type", "after")
      .order("created_at", { ascending: true }),
    supabase
      .from("interactions")
      .select("id, type, summary, created_at")
      .eq("lead_id", job.id)
      .in("type", ["note", "status_change", "call", "email", "sms"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("id, stripe_invoice_url, status")
      .eq("lead_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { estimate, effectiveLeadId } = await getEstimateForPortalJob(supabase, job);

  const baseLeadIds = [
    typeof job?.id === "string" ? job.id : null,
    typeof job?.estimate_job_id === "string" ? job.estimate_job_id : null,
    typeof effectiveLeadId === "string" ? effectiveLeadId : null,
    typeof estimate?.job_id === "string" ? estimate.job_id : null,
  ].filter((value): value is string => Boolean(value));

  const portalDocuments = await fetchPortalDocumentsForLeadFamily(supabase, supabaseUrl, baseLeadIds);

  const requiredDocumentConfigIds = (portalDocuments.configs || [])
    .filter((cfg: any) => {
      const timing = normalizeTiming(cfg?.email_timing);
      return cfg?.include_in_job === true && cfg?.requires_signature === true && timing === "on_estimate_approval";
    })
    .map((cfg: any) => String(cfg.id || ""))
    .filter(Boolean);

  const buildPhotoUrls = (rows: any[] | null) =>
    (rows || []).map((row: any) => ({
      id: row.id,
      url: `${supabaseUrl}/storage/v1/object/public/lead-photos/${row.file_path}`,
      created_at: row.created_at,
    }));

  let estimateVersions: any[] = [];
  if (estimate?.id) {
    const { data: versions } = await supabase
      .from("estimate_versions")
      .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
      .eq("estimate_id", estimate.id)
      .order("created_at", { ascending: true });
    estimateVersions = versions || [];
  }

  const mergeFieldLeadId =
    normalizeText(portalDocuments.leadId) ||
    normalizeText(effectiveLeadId) ||
    normalizeText(job.id);
  const documentTemplateMergeFields = await resolveDocumentTemplateMergeFields({
    supabase,
    accountId: normalizeText(resolvedAccountId),
    leadId: mergeFieldLeadId,
    estimateId: normalizeText(estimate?.id) || null,
  });

  return jsonResponse({
    job: {
      name: job.name,
      address: job.address,
      service_type: job.service_type,
      status: job.status,
      description: job.description,
      created_at: job.created_at,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    },
    company: companyPayload(account),
    schedules: (schedules || []).map((s: any) => ({
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
    })),
    estimate_visit_schedules: [],
    estimate: estimate
      ? {
          ...estimate,
          line_items: ((estimate.line_items || []) as any[])
            .filter((li: any) => !li.is_change_order || li.change_order_type !== "deleted")
            .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
          estimate_versions: estimateVersions,
          job_document_config_lead_id: portalDocuments.leadId,
          job_document_configs: portalDocuments.configs,
          job_documents: portalDocuments.documents,
          required_document_config_ids: requiredDocumentConfigIds,
          document_template_merge_fields: documentTemplateMergeFields,
        }
      : null,
    invoice: invoice ? { stripe_invoice_url: invoice.stripe_invoice_url, status: invoice.status } : null,
    photos: {
      before: buildPhotoUrls(beforePhotos),
      after: buildPhotoUrls(afterPhotos),
    },
    activity: (interactions || []).map((i: any) => ({
      type: i.type,
      summary: i.summary,
      created_at: i.created_at,
    })),
    portal_metadata: {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      has_portal: true,
    },
  });
}

async function handlePostJobAction(supabase: any, supabaseUrl: string, customer: any, jobId: string, req: Request) {
  const { data: job } = await supabase
    .from("leads")
    .select("id, name, estimate_job_id, account_id, customer_id")
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!job) return jsonResponse({ error: "Job not found or access denied" }, 404);

  const body = await req.json();
  const action = String(body?.action || "");
  const updatedAt = String(body?.updated_at || "").trim();
  const signatureDataUrl =
    typeof body?.signature_data_url === "string"
      ? body.signature_data_url
      : typeof body?.signatureDataUrl === "string"
        ? body.signatureDataUrl
        : null;

  if (!["approve", "decline", "approve_changes", "decline_changes", "sign_document", "sign_documents"].includes(action)) {
    return jsonResponse({ error: "Invalid action" }, 400);
  }

  const { estimate, effectiveLeadId } = await getEstimateForPortalJob(supabase, job);
  if (!estimate) return jsonResponse({ error: "No estimate found for this job" }, 404);

  if (!updatedAt || String(estimate.updated_at || "") !== updatedAt) {
    return jsonResponse({ error: "This estimate has been updated since you loaded this page. Please refresh and try again." }, 409);
  }

  if (action === "approve") {
    if (estimate.status === "accepted") return jsonResponse({ error: "This estimate has already been approved" }, 400);
    if (estimate.status === "declined") return jsonResponse({ error: "This estimate has already been declined" }, 400);

    const baseLeadIds = [job.id, job.estimate_job_id, effectiveLeadId, estimate.job_id].filter(Boolean) as string[];
    const portalDocuments = await fetchPortalDocumentsForLeadFamily(supabase, supabaseUrl, baseLeadIds);
    const requiredConfigIds = (portalDocuments.configs || [])
      .filter((cfg: any) => cfg?.include_in_job === true && cfg?.requires_signature === true && normalizeTiming(cfg?.email_timing) === "on_estimate_approval")
      .map((cfg: any) => String(cfg.id || ""))
      .filter(Boolean);

    const agreementAcceptance = body?.agreement_acceptance && typeof body.agreement_acceptance === "object"
      ? body.agreement_acceptance as Record<string, unknown>
      : {};
    const acceptedDocumentConfigMap = Object.fromEntries(
      Object.entries(agreementAcceptance)
        .filter(([key, value]) => isUuid(key) && value === true)
        .map(([key]) => [key, true]),
    );

    const allRequiredAccepted = requiredConfigIds.every((id) => agreementAcceptance[id] === true);
    if (!allRequiredAccepted) {
      return jsonResponse({ error: "Please accept all required documents before approval." }, 400);
    }

    let signaturePublicUrl: string | null = null;
    if (signatureDataUrl) {
      const upload = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
      if (!upload.ok) return jsonResponse({ error: upload.error }, upload.statusCode);
      signaturePublicUrl = upload.publicUrl;
    }

    const acceptedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "accepted",
      accepted_at: acceptedAt,
      approved_via: signaturePublicUrl ? "manual_signature" : "customer_link",
      agreement_acceptance: {
        ...acceptedDocumentConfigMap,
        accepted_at: acceptedAt,
      },
      updated_at: acceptedAt,
    };

    if (signaturePublicUrl) {
      updatePayload.manual_approval_photo_url = signaturePublicUrl;
    }

    const { error } = await supabase
      .from("estimates")
      .update(updatePayload)
      .eq("id", estimate.id);

    if (error) return jsonResponse({ error: "Failed to approve estimate" }, 500);

    if (signaturePublicUrl && requiredConfigIds.length > 0) {
      const allConfigs = portalDocuments.configs || [];
      const allDocuments = portalDocuments.documents || [];
      const signedTargets = requiredConfigIds
        .map((configId) => {
          const config = allConfigs.find((cfg: any) => String(cfg?.id || "") === configId);
          if (!config) return null;
          return {
            config,
            uploadedDocument: resolveUploadedDocumentForConfig(config, allConfigs, allDocuments),
          };
        })
        .filter((target): target is { config: any; uploadedDocument: any | null } => Boolean(target));

      if (signedTargets.length > 0) {
        const accountId = normalizeText(estimate?.account_id || job?.account_id);
        const mergeFieldLeadId =
          normalizeText(portalDocuments.leadId) ||
          normalizeText(effectiveLeadId) ||
          normalizeText(estimate?.job_id) ||
          normalizeText(job?.id);
        const resolvedMergeFields = await resolveDocumentTemplateMergeFields({
          supabase,
          accountId,
          leadId: mergeFieldLeadId,
          estimateId: normalizeText(estimate?.id) || null,
        });
        const fallbackMergeFields: Record<string, string> = {
          current_date: acceptedAt.slice(0, 10),
          job_name: normalizeText(job?.name),
          client_name: normalizeText(customer?.name),
          client_email: normalizeText(customer?.email),
          client_phone: normalizeText(customer?.phone),
          estimate_total: `$${Number(estimate?.total || 0).toFixed(2)}`,
          estimate_subtotal: `$${Number(estimate?.subtotal || 0).toFixed(2)}`,
          estimate_tax: `$${Number(estimate?.tax || 0).toFixed(2)}`,
          estimate_discount: `$${Number(estimate?.discount || 0).toFixed(2)}`,
        };
        const persistResult = await persistSignedJobDocumentPdfs({
          supabase,
          supabaseUrl,
          accountId,
          acceptedAt,
          signaturePublicUrl,
          customerName: normalizeText(customer?.name) || "Customer",
          mergeFields: { ...fallbackMergeFields, ...resolvedMergeFields },
          targets: signedTargets,
        });
        if (!persistResult.ok) {
          return jsonResponse({ error: `Estimate approved, but ${persistResult.error}` }, 500);
        }
      }
    }

    // Intentionally do not send estimate approval SMTP emails from this function.
    // Existing notification flow handles approval emails; this avoids duplicate sends.
    return jsonResponse({ success: true, message: "Estimate approved" });
  }

  if (action === "decline") {
    if (estimate.status === "accepted") return jsonResponse({ error: "This estimate has already been approved" }, 400);
    if (estimate.status === "declined") return jsonResponse({ error: "This estimate has already been declined" }, 400);

    const { error } = await supabase
      .from("estimates")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", estimate.id);

    if (error) return jsonResponse({ error: "Failed to decline estimate" }, 500);
    return jsonResponse({ success: true, message: "Estimate declined" });
  }

  if (action === "approve_changes") {
    if (!estimate.has_pending_changes) return jsonResponse({ error: "No pending changes to approve" }, 400);

    let signaturePublicUrl: string | null = null;
    if (signatureDataUrl) {
      const upload = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
      if (!upload.ok) return jsonResponse({ error: upload.error }, upload.statusCode);
      signaturePublicUrl = upload.publicUrl;
    }

    await supabase
      .from("estimate_line_items")
      .update({ change_order_approved: true })
      .eq("estimate_id", estimate.id)
      .eq("is_change_order", true)
      .eq("change_order_approved", false);

    const payload: Record<string, unknown> = {
      has_pending_changes: false,
      approved_via: signaturePublicUrl ? "manual_signature" : "customer_link",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (signaturePublicUrl) payload.manual_approval_photo_url = signaturePublicUrl;

    const { error } = await supabase.from("estimates").update(payload).eq("id", estimate.id);
    if (error) return jsonResponse({ error: "Failed to approve changes" }, 500);

    return jsonResponse({ success: true, message: "Changes approved" });
  }

  if (action === "decline_changes") {
    if (!estimate.has_pending_changes) return jsonResponse({ error: "No pending changes to decline" }, 400);

    await supabase
      .from("estimate_line_items")
      .delete()
      .eq("estimate_id", estimate.id)
      .eq("is_change_order", true)
      .eq("change_order_approved", false);

    const { error } = await supabase
      .from("estimates")
      .update({ has_pending_changes: false, updated_at: new Date().toISOString() })
      .eq("id", estimate.id);

    if (error) return jsonResponse({ error: "Failed to decline changes" }, 500);
    return jsonResponse({ success: true, message: "Changes declined" });
  }

  // Manual document signing
  const requestedConfigIdsRaw =
    action === "sign_documents" && Array.isArray(body?.document_config_ids)
      ? body.document_config_ids
      : typeof body?.document_config_id === "string"
        ? [body.document_config_id]
        : [];

  const requestedConfigIds = requestedConfigIdsRaw
    .map((value: unknown) => String(value || "").trim())
    .filter(Boolean);

  if (requestedConfigIds.length === 0) {
    return jsonResponse({ error: "At least one document config ID is required" }, 400);
  }
  if (!signatureDataUrl) {
    return jsonResponse({ error: "Signature is required to sign this document." }, 400);
  }
  const parsedSignatureForStamp = parseSignatureDataUrl(signatureDataUrl);
  if (!parsedSignatureForStamp) {
    return jsonResponse({ error: "Invalid signature format. Please sign again." }, 400);
  }
  if (parsedSignatureForStamp.contentType === "image/webp") {
    return jsonResponse({ error: "Please re-sign using PNG or JPEG format." }, 400);
  }

  const baseLeadIds = [job.id, job.estimate_job_id, effectiveLeadId, estimate.job_id].filter(Boolean) as string[];
  const portalDocuments = await fetchPortalDocumentsForLeadFamily(supabase, supabaseUrl, baseLeadIds);
  const allConfigs = portalDocuments.configs || [];
  const allDocuments = portalDocuments.documents || [];

  const signableDocs: Array<{ config: any; uploadedDocument: any }> = [];
  for (const configId of requestedConfigIds) {
    const config = allConfigs.find((row: any) => String(row?.id || "") === configId);
    if (!config) return jsonResponse({ error: "One or more documents are not available for this job." }, 404);

    const uploadedDocument = resolveUploadedDocumentForConfig(config, allConfigs, allDocuments);
    const isSignable =
      config.include_in_job === true
      && normalizeTiming(config.email_timing) === "manual"
      && config.requires_signature === true
      && Boolean(uploadedDocument);

    if (!isSignable) {
      return jsonResponse({ error: "One or more selected documents are not eligible for manual signing." }, 400);
    }

    signableDocs.push({ config, uploadedDocument });
  }

  const upload = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
  if (!upload.ok) return jsonResponse({ error: upload.error }, upload.statusCode);

  const acceptedAt = new Date().toISOString();
  const currentAcceptance =
    estimate.agreement_acceptance && typeof estimate.agreement_acceptance === "object"
      ? estimate.agreement_acceptance
      : {};

  const updatePayload = {
    agreement_acceptance: {
      ...currentAcceptance,
      ...Object.fromEntries(signableDocs.map(({ config }) => [String(config.id), true])),
      accepted_at: acceptedAt,
    },
    manual_approval_photo_url: upload.publicUrl,
    updated_at: acceptedAt,
  };

  const { error: signError } = await supabase
    .from("estimates")
    .update(updatePayload)
    .eq("id", estimate.id);

  if (signError) return jsonResponse({ error: "Failed to sign document" }, 500);

  const requestUrl = new URL(req.url);
  const shareToken = requestUrl.searchParams.get("token");
  const portalLink = shareToken
    ? `${requestUrl.origin}/portal?token=${encodeURIComponent(shareToken)}&jobId=${encodeURIComponent(String(job.id))}`
    : "";
  const resolvedAccountId =
    normalizeText(estimate?.account_id) ||
    (typeof job?.account_id === "string" && job.account_id) ||
    (typeof customer?.account_id === "string" && customer.account_id) ||
    null;
  const resolvedCustomerId =
    normalizeText(estimate?.customer_id) ||
    (typeof customer?.id === "string" ? customer.id : "");
  const { data: account } = resolvedAccountId
    ? await supabase
        .from("accounts")
        .select("id, company_name, company_email")
        .eq("id", resolvedAccountId)
        .maybeSingle()
    : { data: null };
  const { data: estimateCustomer } = resolvedCustomerId
    ? await supabase
        .from("customers")
        .select("id, name, email, phone, account_id")
        .eq("id", resolvedCustomerId)
        .maybeSingle()
    : { data: null };
  if (!account) {
    return jsonResponse({ error: "Document signed, but company configuration is missing." }, 500);
  }
  const customerForEmail = estimateCustomer || customer;
  const mergeFieldLeadId =
    normalizeText(portalDocuments.leadId) ||
    normalizeText(effectiveLeadId) ||
    normalizeText(job.id);
  const resolvedMergeFields = await resolveDocumentTemplateMergeFields({
    supabase,
    accountId: normalizeText(resolvedAccountId),
    leadId: mergeFieldLeadId,
    estimateId: normalizeText(estimate?.id) || null,
  });
  const fallbackMergeFields: Record<string, string> = {
    current_date: new Date().toISOString().slice(0, 10),
    job_name: normalizeText(job?.name),
    job_address: normalizeText(job?.address),
    service_type: normalizeText(job?.service_type) || "Other",
    client_name: normalizeText(customerForEmail?.name),
    client_email: normalizeText(customerForEmail?.email),
    client_phone: normalizeText(customerForEmail?.phone),
    company_name: normalizeText(account?.company_name),
    company_email: normalizeText(account?.company_email),
    company_phone: "Company phone number not provided",
    estimate_total: `$${Number(estimate?.total || 0).toFixed(2)}`,
    estimate_subtotal: `$${Number(estimate?.subtotal || 0).toFixed(2)}`,
    estimate_tax: `$${Number(estimate?.tax || 0).toFixed(2)}`,
    estimate_discount: `$${Number(estimate?.discount || 0).toFixed(2)}`,
  };
  const documentTemplateMergeFields = { ...fallbackMergeFields, ...resolvedMergeFields };

  const persistedSignedDocuments = await persistSignedJobDocumentPdfs({
    supabase,
    supabaseUrl,
    accountId: normalizeText(resolvedAccountId),
    acceptedAt,
    signaturePublicUrl: upload.publicUrl,
    customerName: normalizeText(customerForEmail?.name) || "Customer",
    mergeFields: documentTemplateMergeFields,
    targets: signableDocs,
  });
  if (!persistedSignedDocuments.ok) {
    return jsonResponse({ error: `Document signed, but ${persistedSignedDocuments.error}` }, 500);
  }

  const emailResult = await sendSignedManualDocumentEmails({
    customer: customerForEmail,
    account,
    documentSummaries: persistedSignedDocuments.documentSummaries,
    attachments: persistedSignedDocuments.attachments,
    signatureUrl: upload.publicUrl,
    portalLink,
  });

  if (!emailResult.ok) {
    console.error("Failed to send signed manual document emails:", emailResult.error);
    return jsonResponse({
      success: true,
      message: signableDocs.length > 1
        ? "Documents signed. Notification emails could not be sent."
        : "Document signed. Notification emails could not be sent.",
      notification_error: "Failed to send notification emails.",
    });
  }

  return jsonResponse({ success: true, message: signableDocs.length > 1 ? "Documents signed" : "Document signed" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const jobId = url.searchParams.get("jobId");

    if (!token) return jsonResponse({ error: "Missing share token" }, 400);

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone, account_id")
      .eq("client_portal_token", token)
      .maybeSingle();

    if (!customer) {
      return jsonResponse({ error: "Job not found or link is invalid" }, 404);
    }

    if (req.method === "GET") {
      if (!jobId) return await handleGetPortalList(supabase, customer);
      return await handleGetJobDetail(supabase, supabaseUrl, customer, jobId);
    }

    if (req.method === "POST") {
      if (!jobId) return jsonResponse({ error: "Job ID required for this action" }, 400);
      return await handlePostJobAction(supabase, supabaseUrl, customer, jobId, req);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("job-client-portal error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
