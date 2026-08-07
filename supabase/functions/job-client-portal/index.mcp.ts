import { createClient } from "npm:@supabase/supabase-js@2";
import { handleSingleJobGet } from "./handle-single-job-get.ts";
import { handleRecurringJobPortal } from "./handle-recurring-job-portal.ts";
import { handleEstimateAction } from "./handle-estimate-action.ts";
import { fetchPortalDocumentsForLeadFamily } from "./portal-documents.ts";
import { uploadSignatureDataUrl } from "./signature.ts";
import { signJobRelease } from "./job-release.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function resolveUploadedDocumentForConfig(config: any, allConfigs: any[], allDocuments: any[]) {
  const configId = String(config?.id || "");
  if (configId) {
    const byConfig = allDocuments.find((doc: any) => String(doc?.config_id || "") === configId);
    if (byConfig) return byConfig;

    const byDocumentKeyConfigSuffix = allDocuments.find((doc: any) =>
      String(doc?.document_key || "").endsWith(`_${configId}`),
    );
    if (byDocumentKeyConfigSuffix) return byDocumentKeyConfigSuffix;
  }

  const templateId = String(config?.template?.id || config?.template_id || "");
  if (templateId) {
    const duplicateCount = allConfigs.filter((row: any) => String(row?.template_id || "") === templateId).length;
    if (duplicateCount <= 1) {
      const byTemplate = allDocuments.find((doc: any) => String(doc?.template_id || "") === templateId);
      if (byTemplate) return byTemplate;
    }
  }

  return null;
}

async function getEstimateForPortalJob(supabase: any, job: any) {
  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .select("id, status, expires_at, job_id, customer_id, subtotal, tax, discount, total, updated_at, has_pending_changes, account_id, proposal_settings, agreement_acceptance")
    .eq("job_id", job.id)
    .maybeSingle();

  if (!estError && estimate) {
    return { estimate, effectiveLeadId: String(job.id) };
  }

  const parentLeadId = String(job?.estimate_job_id || "");
  if (!parentLeadId) {
    return { estimate: null, effectiveLeadId: String(job.id) };
  }

  const { data: parentEstimate } = await supabase
    .from("estimates")
    .select("id, status, expires_at, job_id, customer_id, subtotal, tax, discount, total, updated_at, has_pending_changes, account_id, proposal_settings, agreement_acceptance")
    .eq("job_id", parentLeadId)
    .maybeSingle();

  return { estimate: parentEstimate || null, effectiveLeadId: parentLeadId || String(job.id) };
}

async function handleManualDocumentSigning(params: {
  supabase: any;
  supabaseUrl: string;
  req: Request;
  job: any;
  estimate: any;
  effectiveLeadId: string;
  action: string;
  body: any;
  signatureDataUrl: string | null;
}) {
  const { supabase, supabaseUrl, job, estimate, effectiveLeadId, action, body, signatureDataUrl } = params;

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

  const baseLeadIds = [job.id, job.estimate_job_id, effectiveLeadId, estimate.job_id].filter(Boolean) as string[];
  const portalDocuments = await fetchPortalDocumentsForLeadFamily(supabase, supabaseUrl, baseLeadIds, "manual document signing");
  const allConfigs = portalDocuments.configs || [];
  const allDocuments = portalDocuments.documents || [];

  const signableConfigIds: string[] = [];
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

    signableConfigIds.push(String(config.id));
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
      ...Object.fromEntries(signableConfigIds.map((id) => [id, true])),
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

  return jsonResponse({ success: true, message: signableConfigIds.length > 1 ? "Documents signed" : "Document signed" });
}

async function handlePostJobAction(supabase: any, supabaseUrl: string, customer: any, jobId: string, req: Request) {
  const { data: job } = await supabase
    .from("leads")
    .select("id, name, estimate_job_id, account_id, customer_id, recurring_job_id")
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!job) return jsonResponse({ error: "Job not found or access denied" }, 404);

  if (job.recurring_job_id) {
    const { data: recurringJob } = await supabase
      .from("recurring_jobs")
      .select("id, name, address, service_type, frequency, start_date, end_date, account_id, customer_id")
      .eq("id", job.recurring_job_id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (recurringJob) return await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req, jsonResponse);
  }

  const body = await req.json();
  const action = String(body?.action || "");
  const clientUpdatedAt = typeof body?.updated_at === "string" ? body.updated_at : undefined;
  const estimateVersionId = typeof body?.estimate_version_id === "string" ? body.estimate_version_id : null;
  const signatureDataUrl =
    typeof body?.signature_data_url === "string"
      ? body.signature_data_url
      : typeof body?.signatureDataUrl === "string"
        ? body.signatureDataUrl
        : null;
  const agreementAcceptance =
    body && typeof body.agreement_acceptance === "object" && body.agreement_acceptance
      ? body.agreement_acceptance
      : null;

  if (action === "sign_job_release") {
    return await signJobRelease(
      supabase,
      { id: job.id, account_id: job.account_id, customer_id: job.customer_id },
      signatureDataUrl,
      jsonResponse,
    );
  }

  if (!["approve", "decline", "approve_changes", "decline_changes", "sign_document", "sign_documents"].includes(action)) {
    return jsonResponse({ error: "Invalid action" }, 400);
  }

  const { estimate, effectiveLeadId } = await getEstimateForPortalJob(supabase, job);
  if (!estimate) return jsonResponse({ error: "No estimate found for this job" }, 404);

  if (clientUpdatedAt && String(estimate.updated_at || "") !== clientUpdatedAt) {
    return jsonResponse({ error: "This estimate has been updated since you loaded this page. Please refresh and try again." }, 409);
  }

  if (action === "sign_document" || action === "sign_documents") {
    return await handleManualDocumentSigning({
      supabase,
      supabaseUrl,
      req,
      job,
      estimate,
      effectiveLeadId,
      action,
      body,
      signatureDataUrl,
    });
  }

  let requiredDocumentConfigIds: string[] = [];
  if (action === "approve") {
    const baseLeadIds = [
      typeof job?.id === "string" ? job.id : null,
      typeof job?.estimate_job_id === "string" ? job.estimate_job_id : null,
    ].filter((value): value is string => Boolean(value));

    const portalDocuments = await fetchPortalDocumentsForLeadFamily(
      supabase,
      supabaseUrl,
      baseLeadIds,
      "approval required documents",
    );

    requiredDocumentConfigIds = (portalDocuments.configs || [])
      .filter((cfg: any) => {
        const timing = normalizeTiming(cfg?.email_timing);
        return cfg?.include_in_job === true && cfg?.requires_signature === true && timing === "on_estimate_approval";
      })
      .map((cfg: any) => String(cfg.id || ""))
      .filter(Boolean);
  }

  return await handleEstimateAction(
    supabase,
    supabaseUrl,
    estimate,
    action as "approve" | "decline" | "approve_changes" | "decline_changes",
    job.id,
    jsonResponse,
    clientUpdatedAt,
    estimateVersionId,
    signatureDataUrl,
    agreementAcceptance,
    requiredDocumentConfigIds,
  );
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

    if (!customer) return jsonResponse({ error: "Job not found or link is invalid" }, 404);

    if (req.method === "GET") {
      if (!jobId) {
        return jsonResponse({ error: "Job ID required for this action" }, 400);
      }

      const { data: job } = await supabase
        .from("leads")
        .select("id, recurring_job_id")
        .eq("id", jobId)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (!job) return jsonResponse({ error: "Job not found or access denied" }, 404);

      if (job.recurring_job_id) {
        const { data: recurringJob } = await supabase
          .from("recurring_jobs")
          .select("id, name, address, service_type, frequency, start_date, end_date, account_id, customer_id")
          .eq("id", job.recurring_job_id)
          .eq("customer_id", customer.id)
          .maybeSingle();

        if (recurringJob) {
          return await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req, jsonResponse);
        }
      }

      const { data: fullJob } = await supabase
        .from("leads")
        .select("id, name, address, service_type, status, description, created_at, estimate_job_id, account_id, customer_id")
        .eq("id", jobId)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (!fullJob) return jsonResponse({ error: "Job not found or access denied" }, 404);
      return await handleSingleJobGet(supabase, supabaseUrl, fullJob, jsonResponse);
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
