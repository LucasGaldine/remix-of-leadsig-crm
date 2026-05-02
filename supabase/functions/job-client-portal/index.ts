import { createClient } from "npm:@supabase/supabase-js@2";
import {
  resolveAgreementTemplatesForEstimates,
} from "./agreement-templates.ts";
import { handleEstimateAction } from "./handle-estimate-action.ts";
import { handleSingleJobGet } from "./handle-single-job-get.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
      .select("id, name, address, service_type, description, account_id, customer_id, frequency, start_date, end_date, client_share_token, customer:customers!customer_id(name, email, phone)")
      .eq("client_share_token", token)
      .maybeSingle();

    if (recurringJob) {
      return await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req);
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
        created_at,
        updated_at,
        customer:customers!customer_id(name, email, phone)
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
    const jobDetails = await handleRecurringJobPortal(supabase, supabaseUrl, recurringJob, req);
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

async function handleRecurringJobPortal(supabase: any, supabaseUrl: string, recurringJob: any, req: Request) {
  if (req.method === "POST") {
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

    if (action !== "approve" && action !== "decline" && action !== "approve_changes" && action !== "decline_changes") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("id, status, expires_at, job_id, recurring_job_id, updated_at, has_pending_changes, account_id, proposal_settings")
      .eq("recurring_job_id", recurringJob.id)
      .maybeSingle();

    if (estError || !estimate) {
      return jsonResponse({ error: "No quote found for this job schedule" }, 404);
    }

    return await handleEstimateAction(
      supabase,
      estimate,
      action,
      null,
      jsonResponse,
      clientUpdatedAt,
      estimateVersionId,
      signatureDataUrl,
      agreementAcceptance,
      agreementTemplates,
    );
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { data: instances } = await supabase
    .from("leads")
    .select("id, name, status, recurring_instance_number")
    .eq("recurring_job_id", recurringJob.id)
    .order("recurring_instance_number", { ascending: true });

  const instanceIds = (instances || []).map((i: any) => i.id);

  const [
    { data: account },
    { data: estimate },
    { data: allSchedules },
    { data: allBeforePhotos },
    { data: allAfterPhotos },
    { data: allInteractions },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings")
      .eq("id", recurringJob.account_id)
      .maybeSingle(),

    supabase
      .from("estimates")
      .select(`
        id, job_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at, accepted_at, approved_via, manual_approval_photo_url,
        original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
        proposal_settings, project_visualization_image_url, agreement_templates, agreement_acceptance,
        line_items:estimate_line_items(
          id, name, description, quantity, unit, unit_price, total,
          sort_order, is_change_order, change_order_type, change_order_approved, changed_at
        )
      `)
      .eq("recurring_job_id", recurringJob.id)
      .maybeSingle(),

    instanceIds.length > 0
      ? supabase
          .from("job_schedules")
          .select("id, lead_id, scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
          .in("lead_id", instanceIds)
          .order("scheduled_date", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("lead_photos")
          .select("id, lead_id, file_path, created_at")
          .in("lead_id", instanceIds)
          .eq("photo_type", "before")
          .order("created_at", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("lead_photos")
          .select("id, lead_id, file_path, created_at")
          .in("lead_id", instanceIds)
          .eq("photo_type", "after")
          .order("created_at", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("interactions")
          .select("id, type, summary, created_at, lead_id")
          .in("lead_id", instanceIds)
          .in("type", ["note", "status_change", "call", "email", "sms"])
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] },
  ]);

  const buildPhotoUrls = (photos: any[] | null) =>
    (photos || []).map((p: any) => ({
      id: p.id,
      url: `${supabaseUrl}/storage/v1/object/public/lead-photos/${p.file_path}`,
      created_at: p.created_at,
    }));

  const filteredLineItems = estimate
    ? (estimate.line_items || [])
        .filter((li: any) => !li.is_change_order || li.change_order_type !== "deleted")
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    : [];

  let originalLineItemsRecurring = null;
  if (estimate?.original_total) {
    const { data: originals } = await supabase
      .from("estimate_line_items_original")
      .select("id, original_line_item_id, name, description, quantity, unit, unit_price, total, sort_order")
      .eq("estimate_id", estimate.id)
      .order("sort_order");
    originalLineItemsRecurring = originals;
  }

  const { data: estimateVersionsRecurring } = estimate
    ? await supabase
        .from("estimate_versions")
        .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const recurringScopeJobIds = [
    typeof estimate?.job_id === "string" ? estimate.job_id : null,
  ].filter((value): value is string => Boolean(value));
  let recurringScopeItems: string[] = [];
  if (recurringScopeJobIds.length > 0) {
    const { data: recurringChecklistRows } = await supabase
      .from("job_checklist_items")
      .select("job_id, label, sort_order")
      .in("job_id", recurringScopeJobIds)
      .order("sort_order", { ascending: true });

    const grouped = new Map<string, string[]>();
    for (const row of recurringChecklistRows || []) {
      const label = String((row as any).label || "").trim();
      const rowJobId = String((row as any).job_id || "");
      if (!label || !rowJobId) continue;
      const current = grouped.get(rowJobId) || [];
      current.push(label);
      grouped.set(rowJobId, current);
    }

    for (const candidateJobId of recurringScopeJobIds) {
      const items = grouped.get(candidateJobId) || [];
      if (items.length > 0) {
        recurringScopeItems = items;
        break;
      }
    }
  }

  const instanceMap = new Map((instances || []).map((i: any) => [i.id, i]));
  const schedulesWithVisit = (allSchedules || []).map((s: any) => {
    const inst = instanceMap.get(s.lead_id);
    return {
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
      visit_number: inst?.recurring_instance_number || null,
      visit_status: inst?.status || null,
    };
  });

  const recurringResolvedAgreement = resolveAgreementTemplatesForEstimates([estimate]);

  return jsonResponse({
    job: {
      name: recurringJob.name,
      address: recurringJob.address,
      service_type: recurringJob.service_type,
      status: "recurring",
      description: recurringJob.description,
      created_at: null,
      customer: recurringJob.customer,
      is_recurring: true,
      frequency: recurringJob.frequency,
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
    schedules: schedulesWithVisit,
    estimate: estimate
      ? {
          id: estimate.id,
          job_id: estimate.job_id ?? null,
          total: estimate.total,
          subtotal: estimate.subtotal,
          profit_margin: estimate.profit_margin,
          tax_rate: estimate.tax_rate,
          tax: estimate.tax,
          discount: estimate.discount,
          notes: estimate.notes,
          status: estimate.status,
          updated_at: estimate.updated_at,
          accepted_at: estimate.accepted_at ?? null,
          approved_via: estimate.approved_via ?? null,
          manual_approval_photo_url: estimate.manual_approval_photo_url ?? null,
          line_items: filteredLineItems,
          original_total: estimate.original_total,
          original_subtotal: estimate.original_subtotal,
          original_tax: estimate.original_tax,
          original_discount: estimate.original_discount,
          original_notes: estimate.original_notes,
          original_line_items: originalLineItemsRecurring,
          has_pending_changes: estimate.has_pending_changes,
          proposal_settings: estimate.proposal_settings || null,
          scope_of_work_items: recurringScopeItems,
          project_visualization_image_url: estimate.project_visualization_image_url || null,
          agreement_templates: recurringResolvedAgreement.templates,
          agreement_source_estimate_id: recurringResolvedAgreement.sourceEstimateId,
          agreement_acceptance: estimate.agreement_acceptance || null,
          estimate_versions: estimateVersionsRecurring || [],
        }
      : null,
    photos: {
      before: buildPhotoUrls(allBeforePhotos),
      after: buildPhotoUrls(allAfterPhotos),
    },
    invoice: null,
    estimate_visit_schedules: [],
    activity: (allInteractions || []).map((i: any) => ({
      type: i.type,
      summary: i.summary,
      created_at: i.created_at,
    })),
  });
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
  );
}

