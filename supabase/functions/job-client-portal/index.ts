import { createClient } from "npm:@supabase/supabase-js@2";

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

const MAX_SIGNATURE_IMAGE_BYTES = 6 * 1024 * 1024;

function isManualApprovalPhotoUrlColumnMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "42703") return true;

  const message = [
    (error as { message?: string }).message,
    (error as { details?: string }).details,
    (error as { hint?: string }).hint,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  return message.includes("manual_approval_photo_url");
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseSignatureDataUrl(signatureDataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } | null {
  const trimmedValue = signatureDataUrl.trim();
  const match = trimmedValue.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
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

  if (!bytes.length || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) {
    return null;
  }

  return { bytes, contentType, extension };
}

async function uploadSignatureDataUrl(
  supabase: any,
  estimateId: string,
  signatureDataUrl: string,
): Promise<{ ok: true; filePath: string; publicUrl: string } | { ok: false; error: string; statusCode: number }> {
  const parsedImage = parseSignatureDataUrl(signatureDataUrl);
  if (!parsedImage) {
    return { ok: false, error: "Invalid signature format. Please sign again.", statusCode: 400 };
  }

  const filePath = `estimate-approvals/${estimateId}/${crypto.randomUUID()}.${parsedImage.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("lead-photos")
    .upload(filePath, parsedImage.bytes, {
      contentType: parsedImage.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: "Failed to upload signature image", statusCode: 500 };
  }

  const { data: urlData } = supabase.storage.from("lead-photos").getPublicUrl(filePath);
  return { ok: true, filePath, publicUrl: urlData.publicUrl };
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
      return await handleCustomerPortal(supabase, supabaseUrl, customer, jobId, req);
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

    return await handleSingleJobGet(supabase, supabaseUrl, job);
  } catch (error) {
    console.error("job-client-portal error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleCustomerPortal(supabase: any, supabaseUrl: string, customer: any, jobId: string | null, req: Request) {
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
    const jobDetails = await handleSingleJobGet(supabase, supabaseUrl, job);
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

    if (action !== "approve" && action !== "decline" && action !== "approve_changes" && action !== "decline_changes") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("id, status, expires_at, job_id, recurring_job_id, updated_at, has_pending_changes")
      .eq("recurring_job_id", recurringJob.id)
      .maybeSingle();

    if (estError || !estimate) {
      return jsonResponse({ error: "No quote found for this job schedule" }, 404);
    }

    return await handleEstimateAction(supabase, estimate, action, null, clientUpdatedAt, estimateVersionId, signatureDataUrl);
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
        id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at,
        original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
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
          total: estimate.total,
          subtotal: estimate.subtotal,
          profit_margin: estimate.profit_margin,
          tax_rate: estimate.tax_rate,
          tax: estimate.tax,
          discount: estimate.discount,
          notes: estimate.notes,
          status: estimate.status,
          updated_at: estimate.updated_at,
          line_items: filteredLineItems,
          original_total: estimate.original_total,
          original_subtotal: estimate.original_subtotal,
          original_tax: estimate.original_tax,
          original_discount: estimate.original_discount,
          original_notes: estimate.original_notes,
          original_line_items: originalLineItemsRecurring,
          has_pending_changes: estimate.has_pending_changes,
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

  if (action !== "approve" && action !== "decline" && action !== "approve_changes" && action !== "decline_changes") {
    return jsonResponse({ error: "Invalid action" }, 400);
  }

  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .select("id, status, expires_at, job_id, updated_at, has_pending_changes")
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
      .select("id, status, expires_at, job_id, updated_at, has_pending_changes")
      .eq("job_id", parentLead.id)
      .maybeSingle();

    if (peError || !parentEstimate) {
      return jsonResponse({ error: "No estimate found for this job" }, 404);
    }

    return await handleEstimateAction(supabase, parentEstimate, action, job.id, clientUpdatedAt, estimateVersionId, signatureDataUrl);
  }

  return await handleEstimateAction(supabase, estimate, action, job.id, clientUpdatedAt, estimateVersionId, signatureDataUrl);
}

async function handleSingleJobGet(supabase: any, supabaseUrl: string, job: any) {
  const [
    { data: account },
    { data: schedules },
    { data: estimate },
    { data: beforePhotos },
    { data: afterPhotos },
    { data: interactions },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings")
      .eq("id", job.account_id)
      .maybeSingle(),

    supabase
      .from("job_schedules")
      .select("id, scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
      .eq("lead_id", job.id)
      .order("scheduled_date", { ascending: true }),

    supabase
      .from("estimates")
      .select(
        `
        id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at,
        original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
        line_items:estimate_line_items(
          id, name, description, quantity, unit, unit_price, total,
          sort_order, is_change_order, change_order_type, change_order_approved, changed_at
        )
      `
      )
      .eq("job_id", job.id)
      .maybeSingle(),

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
      .limit(20),
  ]);

  let parentEstimate = estimate;
  if (!parentEstimate) {
    const { data: parentLead } = await supabase
      .from("leads")
      .select("id")
      .eq("estimate_job_id", job.id)
      .maybeSingle();

    if (parentLead) {
      const { data: pe } = await supabase
        .from("estimates")
        .select(
          `
          id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at,
          original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
          line_items:estimate_line_items(
            id, name, description, quantity, unit, unit_price, total,
            sort_order, is_change_order, change_order_type, change_order_approved
          )
        `
        )
        .eq("job_id", parentLead.id)
        .maybeSingle();
      parentEstimate = pe;
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, stripe_invoice_url, status")
    .eq("lead_id", job.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let estimateVisitSchedules: any[] = [];
  if (job.estimate_job_id) {
    const { data: evSchedules } = await supabase
      .from("job_schedules")
      .select("scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
      .eq("lead_id", job.estimate_job_id)
      .order("scheduled_date", { ascending: true });
    estimateVisitSchedules = evSchedules || [];
  }

  const buildPhotoUrls = (photos: any[] | null) =>
    (photos || []).map((p: any) => ({
      id: p.id,
      url: `${supabaseUrl}/storage/v1/object/public/lead-photos/${p.file_path}`,
      created_at: p.created_at,
    }));

  const filteredLineItems = parentEstimate
    ? (parentEstimate.line_items || [])
        .filter(
          (li: any) =>
            !li.is_change_order || li.change_order_type !== "deleted"
        )
        .sort(
          (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
        )
    : [];

  let originalLineItems = null;
  if (parentEstimate?.original_total) {
    const { data: originals } = await supabase
      .from("estimate_line_items_original")
      .select("id, original_line_item_id, name, description, quantity, unit, unit_price, total, sort_order")
      .eq("estimate_id", parentEstimate.id)
      .order("sort_order");
    originalLineItems = originals;
  }

  const { data: estimateVersions } = parentEstimate
    ? await supabase
        .from("estimate_versions")
        .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
        .eq("estimate_id", parentEstimate.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return jsonResponse({
    job: {
      name: job.name,
      address: job.address,
      service_type: job.service_type,
      status: job.status,
      description: job.description,
      created_at: job.created_at,
      customer: job.customer,
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
    schedules: (schedules || []).map((s: any) => ({
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
    })),
    estimate: parentEstimate
      ? {
          total: parentEstimate.total,
          subtotal: parentEstimate.subtotal,
          profit_margin: parentEstimate.profit_margin,
          tax_rate: parentEstimate.tax_rate,
          tax: parentEstimate.tax,
          discount: parentEstimate.discount,
          notes: parentEstimate.notes,
          status: parentEstimate.status,
          updated_at: parentEstimate.updated_at,
          line_items: filteredLineItems,
          original_total: parentEstimate.original_total,
          original_subtotal: parentEstimate.original_subtotal,
          original_tax: parentEstimate.original_tax,
          original_discount: parentEstimate.original_discount,
          original_notes: parentEstimate.original_notes,
          original_line_items: originalLineItems,
          has_pending_changes: parentEstimate.has_pending_changes,
          estimate_versions: estimateVersions || [],
        }
      : null,
    photos: {
      before: buildPhotoUrls(beforePhotos),
      after: buildPhotoUrls(afterPhotos),
    },
    invoice: invoice ? {
      stripe_invoice_url: invoice.stripe_invoice_url,
      status: invoice.status,
    } : null,
    estimate_visit_schedules: estimateVisitSchedules.map((s: any) => ({
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
    })),
    activity: (interactions || []).map((i: any) => ({
      type: i.type,
      summary: i.summary,
      created_at: i.created_at,
    })),
  });
}

async function handleEstimateAction(
  supabase: any,
  estimate: { id: string; status: string; expires_at: string | null; job_id: string | null; recurring_job_id?: string | null; updated_at: string; has_pending_changes?: boolean },
  action: "approve" | "decline" | "approve_changes" | "decline_changes",
  portalJobId: string | null,
  clientUpdatedAt?: string,
  estimateVersionId?: string | null,
  signatureDataUrl?: string | null,
) {
  if (clientUpdatedAt && estimate.updated_at !== clientUpdatedAt) {
    return jsonResponse({
      error: "This estimate has been updated since you loaded this page. Please refresh the page to see the latest version before approving."
    }, 409);
  }

  if (action === "approve_changes" || action === "decline_changes") {
    if (!estimate.has_pending_changes) {
      return jsonResponse({ error: "No pending changes to approve" }, 400);
    }

    if (action === "approve_changes") {
      let uploadedSignature: { filePath: string; publicUrl: string } | null = null;
      if (signatureDataUrl) {
        const uploadedResult = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
        if (!uploadedResult.ok) {
          return jsonResponse({ error: uploadedResult.error }, uploadedResult.statusCode);
        }
        uploadedSignature = { filePath: uploadedResult.filePath, publicUrl: uploadedResult.publicUrl };
      }

      const { error: approveError } = await supabase
        .from("estimate_line_items")
        .update({ change_order_approved: true })
        .eq("estimate_id", estimate.id)
        .eq("is_change_order", true)
        .eq("change_order_approved", false);

      if (approveError) {
        if (uploadedSignature?.filePath) {
          await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
        }
        return jsonResponse({ error: "Failed to approve changes" }, 500);
      }

      const changeApprovalUpdatePayload: Record<string, unknown> = {
        approved_via: "customer_link",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (uploadedSignature) {
        changeApprovalUpdatePayload.manual_approval_photo_url = uploadedSignature.publicUrl;
      }

      const { error: changeApprovalUpdateError } = await supabase
        .from("estimates")
        .update(changeApprovalUpdatePayload)
        .eq("id", estimate.id);

      if (changeApprovalUpdateError && uploadedSignature && isManualApprovalPhotoUrlColumnMissing(changeApprovalUpdateError)) {
        const { manual_approval_photo_url: _manualApprovalPhotoUrl, ...fallbackPayload } = changeApprovalUpdatePayload;
        const { error: fallbackError } = await supabase
          .from("estimates")
          .update(fallbackPayload)
          .eq("id", estimate.id);

        if (uploadedSignature.filePath) {
          await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
        }

        if (fallbackError) {
          return jsonResponse({ error: "Failed to finalize change-order approval" }, 500);
        }
      } else if (changeApprovalUpdateError) {
        if (uploadedSignature?.filePath) {
          await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
        }
        return jsonResponse({ error: "Failed to finalize change-order approval" }, 500);
      }

      return jsonResponse({ success: true, message: "Changes approved" });
    } else {
      const { error: declineError } = await supabase
        .from("estimate_line_items")
        .delete()
        .eq("estimate_id", estimate.id)
        .eq("is_change_order", true)
        .eq("change_order_approved", false);

      if (declineError) {
        return jsonResponse({ error: "Failed to decline changes" }, 500);
      }

      return jsonResponse({ success: true, message: "Changes declined" });
    }
  }

  if (estimate.status === "accepted") {
    return jsonResponse({ error: "This estimate has already been approved" }, 400);
  }

  if (estimate.status === "declined") {
    return jsonResponse({ error: "This estimate has already been declined" }, 400);
  }

  if (
    estimate.expires_at &&
    new Date(estimate.expires_at) < new Date()
  ) {
    return jsonResponse({ error: "This estimate has expired" }, 400);
  }

  if (action === "approve") {
    let uploadedSignature: { filePath: string; publicUrl: string } | null = null;
    if (signatureDataUrl) {
      const uploadedResult = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
      if (!uploadedResult.ok) {
        return jsonResponse({ error: uploadedResult.error }, uploadedResult.statusCode);
      }
      uploadedSignature = { filePath: uploadedResult.filePath, publicUrl: uploadedResult.publicUrl };
    }

    if (estimateVersionId) {
      const applyResult = await applyEstimateVersionBeforeApproval(supabase, estimate.id, estimateVersionId);
      if (!applyResult.ok) {
        if (uploadedSignature?.filePath) {
          await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
        }
        return jsonResponse({ error: applyResult.error }, applyResult.statusCode);
      }
    }

    const estimateUpdatePayload: Record<string, unknown> = {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      approved_via: "customer_link",
      updated_at: new Date().toISOString(),
    };

    if (uploadedSignature) {
      estimateUpdatePayload.manual_approval_photo_url = uploadedSignature.publicUrl;
    }

    const { error } = await supabase
      .from("estimates")
      .update(estimateUpdatePayload)
      .eq("id", estimate.id);

    if (error && uploadedSignature && isManualApprovalPhotoUrlColumnMissing(error)) {
      const { manual_approval_photo_url: _manualApprovalPhotoUrl, ...fallbackPayload } = estimateUpdatePayload;
      const { error: fallbackError } = await supabase
        .from("estimates")
        .update(fallbackPayload)
        .eq("id", estimate.id);

      if (uploadedSignature.filePath) {
        await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
      }

      if (fallbackError) {
        return jsonResponse({ error: "Failed to approve estimate" }, 500);
      }
    } else if (error) {
      if (uploadedSignature?.filePath) {
        await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
      }
      return jsonResponse({ error: "Failed to approve estimate" }, 500);
    }

    const pruneResult = await pruneEstimateVersionsAfterApproval(
      supabase,
      estimate.id,
      estimateVersionId ?? null,
    );
    if (!pruneResult.ok) {
      console.error("Failed to prune estimate versions after approval:", pruneResult.error);
    }

    return jsonResponse({ success: true, message: "Estimate approved" });
  }

  const { error: declineError } = await supabase
    .from("estimates")
    .update({
      status: "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);

  if (declineError) {
    return jsonResponse({ error: "Failed to decline estimate" }, 500);
  }

  if (estimate.job_id) {
    await supabase
      .from("leads")
      .update({
        approval_status: "rejected",
        approval_reason: "estimate_declined",
        rejected_at: new Date().toISOString(),
      })
      .eq("id", estimate.job_id);

    const { data: estimateJobLead } = await supabase
      .from("leads")
      .select("estimate_job_id")
      .eq("id", estimate.job_id)
      .maybeSingle();

    if (estimateJobLead?.estimate_job_id) {
      await supabase
        .from("leads")
        .update({ status: "completed" })
        .eq("id", estimateJobLead.estimate_job_id);
    }
  }

  return jsonResponse({ success: true, message: "Estimate declined" });
}

async function applyEstimateVersionBeforeApproval(
  supabase: any,
  estimateId: string,
  estimateVersionId: string,
): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  const { data: version, error: versionError } = await supabase
    .from("estimate_versions")
    .select("id, estimate_id, account_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, line_items")
    .eq("id", estimateVersionId)
    .eq("estimate_id", estimateId)
    .maybeSingle();

  if (versionError || !version) {
    return { ok: false, error: "Selected estimate version was not found", statusCode: 400 };
  }

  const { error: deleteLineItemsError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);

  if (deleteLineItemsError) {
    return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
  }

  const lineItems = Array.isArray(version.line_items) ? version.line_items : [];
  if (lineItems.length > 0) {
    const inserts = lineItems.map((item: any, index: number) => ({
      estimate_id: estimateId,
      account_id: version.account_id,
      name: item.name || "Line item",
      description: item.description || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "item",
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      sort_order: Number(item.sort_order ?? index),
      category: item.category || "other",
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
      original_line_item_id: null,
    }));

    const { error: insertLineItemsError } = await supabase
      .from("estimate_line_items")
      .insert(inserts);

    if (insertLineItemsError) {
      return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
    }
  }

  const { error: updateEstimateError } = await supabase
    .from("estimates")
    .update({
      subtotal: Number(version.subtotal) || 0,
      tax_rate: Number(version.tax_rate) || 0,
      tax: Number(version.tax) || 0,
      discount: Number(version.discount) || 0,
      total: Number(version.total) || 0,
      profit_margin: Number(version.profit_margin) || 0,
      surcharge: Number(version.surcharge) || 0,
      notes: version.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);

  if (updateEstimateError) {
    return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
  }

  return { ok: true };
}

async function pruneEstimateVersionsAfterApproval(
  supabase: any,
  estimateId: string,
  keepVersionId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let deleteQuery = supabase
    .from("estimate_versions")
    .delete()
    .eq("estimate_id", estimateId);

  if (keepVersionId) {
    deleteQuery = deleteQuery.neq("id", keepVersionId);
  }

  const { error } = await deleteQuery;
  if (error) {
    return { ok: false, error: "Failed to remove unused estimate versions" };
  }

  return { ok: true };
}
