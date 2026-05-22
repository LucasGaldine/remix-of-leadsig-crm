import { createClient } from "npm:@supabase/supabase-js@2";
import { handleEstimateAction } from "./handle-estimate-action.ts";
import { handleRecurringJobPortal } from "./handle-recurring-job-portal.ts";
import { handleSingleJobGet } from "./handle-single-job-get.ts";
import { fetchPortalDocumentsForLeadFamily } from "./portal-documents.ts";
import { signJobRelease } from "./job-release.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_USER_AGENT_PATTERN =
  /(bot|crawler|spider|slurp|facebookexternalhit|linkedinbot|twitterbot|whatsapp|slackbot|discordbot|telegrambot|googleweblight)/i;
const PORTAL_VIEW_COUNT_THROTTLE_MS = 15 * 60 * 1000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return null;
}

function shouldTrackPortalView(req: Request): boolean {
  if (req.method !== "GET") return false;
  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent) return true;
  return !BOT_USER_AGENT_PATTERN.test(userAgent);
}

async function recordCustomerPortalView(supabase: any, customerId: string, req: Request) {
  if (!shouldTrackPortalView(req) || !customerId) return;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("portal_first_viewed_at, portal_last_viewed_at, portal_view_count")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    if (customerError) console.error("Failed to load customer for portal view tracking:", customerError);
    return;
  }

  const nowIso = new Date().toISOString();
  const lastViewedMs = customer.portal_last_viewed_at ? new Date(customer.portal_last_viewed_at).getTime() : null;
  const nowMs = Date.now();
  const shouldIncrementCount = !lastViewedMs || nowMs - lastViewedMs >= PORTAL_VIEW_COUNT_THROTTLE_MS;
  const nextViewCount = shouldIncrementCount ? Number(customer.portal_view_count || 0) + 1 : Number(customer.portal_view_count || 0);
  const viewMeta = {
    ip: getClientIp(req),
    user_agent: req.headers.get("user-agent") || null,
    path: (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return null;
      }
    })(),
  };

  const updatePayload: Record<string, unknown> = {
    portal_last_viewed_at: nowIso,
    portal_view_count: nextViewCount,
    portal_last_view_meta: viewMeta,
  };

  if (!customer.portal_first_viewed_at) {
    updatePayload.portal_first_viewed_at = nowIso;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update(updatePayload)
    .eq("id", customerId);

  if (updateError) {
    console.error("Failed to update customer portal view tracking:", updateError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const jobId = url.searchParams.get("jobId");

    if (!token) {
      return jsonResponse({ error: "Missing share token" }, 400);
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone, account_id")
      .eq("client_portal_token", token)
      .maybeSingle();

    if (customer) {
      return await handleClientPortal(supabase, supabaseUrl, customer, jobId, req);
    }

    const { data: recurringJob } = await supabase
      .from("recurring_jobs")
      .select("id, name, address, service_type, description, account_id, customer_id, frequency, start_date, end_date, client_share_token, customer:customers!customer_id(id, name, email, phone)")
      .eq("client_share_token", token)
      .maybeSingle();

    if (recurringJob) {
      await recordCustomerPortalView(supabase, recurringJob.customer_id, req);
      return await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req, jsonResponse);
    }

    const { data: job, error: jobError } = await supabase
      .from("leads")
      .select(
        `
        id,
        name,
        address,
        service_type,
        status,
        description,
        actual_value,
        is_estimate_visit,
        estimate_job_id,
        account_id,
        customer_id,
        created_at,
        updated_at,
        customer:customers!customer_id(id, name, email, phone)
      `
      )
      .eq("client_share_token", token)
      .maybeSingle();

    if (jobError || !job) {
      return jsonResponse({ error: "Job not found or link is invalid" }, 404);
    }

    if (req.method === "POST") {
      return await handleSingleJobPost(supabase, job, req);
    }

    if (req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (job.customer_id) {
      await recordCustomerPortalView(supabase, job.customer_id, req);
    }

    return await handleSingleJobGet(supabase, supabaseUrl, job, jsonResponse);
  } catch (error) {
    console.error("job-client-portal error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleClientPortal(supabase: any, supabaseUrl: string, customer: any, jobId: string | null, req: Request) {
  if (req.method === "POST") {
    if (!jobId) {
      return jsonResponse({ error: "Job ID required for this action" }, 400);
    }
    const { data: job } = await supabase
      .from("leads")
      .select("id, customer_id, account_id")
      .eq("id", jobId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!job) {
      return jsonResponse({ error: "Job not found or access denied" }, 404);
    }

    return await handleSingleJobPost(supabase, { ...job, customer }, req);
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  await recordCustomerPortalView(supabase, customer.id, req);

  if (!jobId) {
    const { data: jobs } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        address,
        service_type,
        status,
        created_at,
        updated_at,
        is_estimate_visit,
        estimate_job_id
      `)
      .eq("customer_id", customer.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    const { data: recurringJobs } = await supabase
      .from("recurring_jobs")
      .select(`
        id,
        name,
        address,
        service_type,
        frequency,
        start_date,
        end_date,
        created_at
      `)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings")
      .eq("id", customer.account_id)
      .maybeSingle();

    const { data: invoices } = await supabase
      .from("invoices")
      .select(`
        id,
        lead_id,
        stripe_invoice_url,
        status,
        total,
        created_at,
        leads!inner(customer_id, name, service_type)
      `)
      .eq("leads.customer_id", customer.id)
      .order("created_at", { ascending: false });

    const regularJobs = (jobs || []).filter((j: any) => !j.is_estimate_visit);
    const estimateVisitJobs = (jobs || []).filter((j: any) => j.is_estimate_visit && !j.estimate_job_id);

    const displayJobs = regularJobs.length > 0 ? regularJobs : estimateVisitJobs;

    return jsonResponse({
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      company: account
        ? {
            company_name: account.company_name,
            company_email: account.company_email,
            company_phone: account.company_phone,
            logo_url: account.logo_url,
            portal_color: account.settings?.client_portal_color ?? null,
            portal_text_color: account.settings?.client_portal_text_color ?? null,
            client_portal_color: account.settings?.client_portal_color ?? null,
            client_portal_text_color: account.settings?.client_portal_text_color ?? null,
            settings: account.settings ?? null,
          }
        : {},
      jobs: displayJobs.map((j: any) => ({
        id: j.id,
        name: j.name,
        address: j.address,
        service_type: j.service_type,
        status: j.status,
        created_at: j.created_at,
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
    });
  }

  const { data: job } = await supabase
    .from("leads")
    .select(`
      id,
      name,
      address,
      service_type,
      status,
      description,
      actual_value,
      is_estimate_visit,
      estimate_job_id,
      account_id,
      created_at,
      updated_at
    `)
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (job) {
    job.customer = customer;
    const jobDetails = await handleSingleJobGet(supabase, supabaseUrl, job, jsonResponse);
    const jobData = await jobDetails.json();
    return jsonResponse({
      ...jobData,
      portal_metadata: {
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        has_portal: true,
      }
    });
  }

  const { data: recurringJob } = await supabase
    .from("recurring_jobs")
    .select("id, name, address, service_type, description, account_id, customer_id, frequency, start_date, end_date")
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (recurringJob) {
    recurringJob.customer = customer;
    recurringJob.client_share_token = null;
    const jobDetails = await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req, jsonResponse);
    const jobData = await jobDetails.json();
    return jsonResponse({
      ...jobData,
      portal_metadata: {
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        has_portal: true,
      }
    });
  }

  return jsonResponse({ error: "Job not found or access denied" }, 404);
}

async function handleSingleJobPost(supabase: any, job: any, req: Request) {
  const body = await req.json();
  const action = body.action;
  const clientUpdatedAt = body.updated_at;
  const estimateVersionId = typeof body.estimate_version_id === "string" ? body.estimate_version_id : null;
  const signatureDataUrl =
    typeof body.signature_data_url === "string"
      ? body.signature_data_url
      : typeof body.signatureDataUrl === "string"
        ? body.signatureDataUrl
        : null;
  const agreementAcceptance =
    body && typeof body.agreement_acceptance === "object" && body.agreement_acceptance
      ? body.agreement_acceptance
      : null;
  const agreementTemplates =
    body && typeof body.agreement_templates === "object" && body.agreement_templates
      ? body.agreement_templates
      : null;
  let requiredDocumentConfigIds: string[] = [];

  if (action === "approve") {
    const baseDocumentLeadIds = [
      typeof job?.estimate_job_id === "string" ? job.estimate_job_id : null,
      typeof job?.id === "string" ? job.id : null,
    ].filter((value): value is string => Boolean(value));
    const portalDocuments = await fetchPortalDocumentsForLeadFamily(
      supabase,
      Deno.env.get("SUPABASE_URL")!,
      baseDocumentLeadIds,
      "approval required documents",
    );
    requiredDocumentConfigIds = (portalDocuments.configs || [])
      .filter((config: any) => {
        const timing = String(config?.email_timing || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
        return config?.include_in_job === true
          && timing === "on_estimate_approval"
          && config?.requires_signature === true;
      })
      .map((config: any) => String(config.id || ""))
      .filter(Boolean);
  }

  if (action === "sign_job_release") {
    return await signJobRelease(
      supabase,
      { id: job.id, account_id: job.account_id, customer_id: job.customer_id },
      signatureDataUrl,
      jsonResponse,
    );
  }

  if (action !== "approve" && action !== "decline" && action !== "approve_changes" && action !== "decline_changes") {
    return jsonResponse({ error: "Invalid action" }, 400);
  }

  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .select("id, status, expires_at, job_id, updated_at, has_pending_changes, account_id, proposal_settings")
    .eq("job_id", job.id)
    .maybeSingle();

  if (estError || !estimate) {
    const { data: parentLead } = await supabase
      .from("leads")
      .select("id")
      .eq("estimate_job_id", job.id)
      .maybeSingle();

    if (!parentLead) {
      return jsonResponse({ error: "No estimate found for this job" }, 404);
    }

    const { data: parentEstimate, error: peError } = await supabase
      .from("estimates")
      .select("id, status, expires_at, job_id, updated_at, has_pending_changes, account_id, proposal_settings")
      .eq("job_id", parentLead.id)
      .maybeSingle();

    if (peError || !parentEstimate) {
      return jsonResponse({ error: "No estimate found for this job" }, 404);
    }

    return await handleEstimateAction(
      supabase,
      parentEstimate,
      action,
      job.id,
      jsonResponse,
      clientUpdatedAt,
      estimateVersionId,
      signatureDataUrl,
      agreementAcceptance,
      agreementTemplates,
      requiredDocumentConfigIds,
    );
  }

  return await handleEstimateAction(
    supabase,
    estimate,
    action,
    job.id,
    jsonResponse,
    clientUpdatedAt,
    estimateVersionId,
    signatureDataUrl,
    agreementAcceptance,
    agreementTemplates,
    requiredDocumentConfigIds,
  );
}
