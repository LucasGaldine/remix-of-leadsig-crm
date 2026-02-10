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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    if (!token) {
      return jsonResponse({ error: "Missing share token" }, 400);
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
      const body = await req.json();
      const action = body.action;

      if (action !== "approve" && action !== "decline") {
        return jsonResponse({ error: "Invalid action" }, 400);
      }

      const { data: estimate, error: estError } = await supabase
        .from("estimates")
        .select("id, status, expires_at, job_id")
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
          .select("id, status, expires_at, job_id")
          .eq("job_id", parentLead.id)
          .maybeSingle();

        if (peError || !parentEstimate) {
          return jsonResponse({ error: "No estimate found for this job" }, 404);
        }

        return await handleEstimateAction(supabase, parentEstimate, action, job.id);
      }

      return await handleEstimateAction(supabase, estimate, action, job.id);
    }

    if (req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

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
        .select("company_name, company_email, company_phone, logo_url")
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
          id, subtotal, tax_rate, tax, discount, total, notes, status, created_at,
          line_items:estimate_line_items(
            id, name, description, quantity, unit, unit_price, total,
            sort_order, is_change_order, change_order_type, changed_at
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
            id, subtotal, tax_rate, tax, discount, total, notes, status, created_at,
            line_items:estimate_line_items(
              id, name, description, quantity, unit, unit_price, total,
              sort_order, is_change_order, change_order_type
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
      company: account || {},
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
            tax_rate: parentEstimate.tax_rate,
            tax: parentEstimate.tax,
            discount: parentEstimate.discount,
            notes: parentEstimate.notes,
            status: parentEstimate.status,
            line_items: filteredLineItems,
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
  } catch (error) {
    console.error("job-client-portal error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleEstimateAction(
  supabase: any,
  estimate: { id: string; status: string; expires_at: string | null; job_id: string },
  action: "approve" | "decline",
  portalJobId: string
) {
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
    const { error } = await supabase
      .from("estimates")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        approved_via: "customer_link",
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (error) {
      return jsonResponse({ error: "Failed to approve estimate" }, 500);
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
      .update({
        status: "completed",
      })
      .eq("id", estimateJobLead.estimate_job_id);
  }

  return jsonResponse({ success: true, message: "Estimate declined" });
}
