import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
      return new Response(
        JSON.stringify({ error: "Missing share token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        account_id,
        created_at,
        updated_at,
        customer:customers!customer_id(name, email, phone)
      `
      )
      .eq("client_share_token", token)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found or link is invalid" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
            sort_order, is_change_order, change_order_type
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

    return new Response(
      JSON.stringify({
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
        activity: (interactions || []).map((i: any) => ({
          type: i.type,
          summary: i.summary,
          created_at: i.created_at,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("job-client-portal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
