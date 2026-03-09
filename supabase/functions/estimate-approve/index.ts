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
        JSON.stringify({ error: "Missing approval token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "GET") {
      const { data: estimate, error } = await supabase
        .from("estimates")
        .select(
          `
          id,
          subtotal,
          tax_rate,
          tax,
          discount,
          total,
          notes,
          status,
          expires_at,
          created_at,
          accepted_at,
          approved_via,
          account_id,
          original_subtotal,
          original_tax,
          original_discount,
          original_total,
          original_notes,
          customer:customers(name, email, phone),
          job:leads!estimates_job_id_fkey(name, address, service_type),
          line_items:estimate_line_items(
            id,
            name,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order,
            is_change_order,
            change_order_type
          )
        `
        )
        .eq("approval_token", token)
        .maybeSingle();

      if (error || !estimate) {
        return new Response(
          JSON.stringify({ error: "Estimate not found or link is invalid" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: account } = await supabase
        .from("accounts")
        .select("company_name, company_email, company_phone, logo_url")
        .eq("id", estimate.account_id)
        .maybeSingle();

      let originalLineItems = null;
      if (estimate.original_total) {
        const { data: originals } = await supabase
          .from("estimate_line_items_original")
          .select("*")
          .eq("estimate_id", estimate.id)
          .order("sort_order");
        originalLineItems = originals;
      }

      return new Response(
        JSON.stringify({
          estimate: {
            ...estimate,
            line_items: (estimate.line_items || [])
              .filter(
                (li: { is_change_order?: boolean; change_order_type?: string }) =>
                  !li.is_change_order || li.change_order_type !== "deleted"
              )
              .sort(
                (a: { sort_order?: number }, b: { sort_order?: number }) =>
                  (a.sort_order || 0) - (b.sort_order || 0)
              ),
            original_line_items: originalLineItems,
          },
          company: account || {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const { data: estimate, error: fetchError } = await supabase
        .from("estimates")
        .select("id, status, expires_at, job_id")
        .eq("approval_token", token)
        .maybeSingle();

      if (fetchError || !estimate) {
        return new Response(
          JSON.stringify({ error: "Estimate not found or link is invalid" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (estimate.status === "accepted") {
        return new Response(
          JSON.stringify({
            error: "This estimate has already been approved",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (
        estimate.expires_at &&
        new Date(estimate.expires_at) < new Date()
      ) {
        return new Response(
          JSON.stringify({ error: "This estimate has expired" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: updateError } = await supabase
        .from("estimates")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          approved_via: "customer_link",
          updated_at: new Date().toISOString(),
        })
        .eq("id", estimate.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to approve estimate" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Estimate approved" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("estimate-approve error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
