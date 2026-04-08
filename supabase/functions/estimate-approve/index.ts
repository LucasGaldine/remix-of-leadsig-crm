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
          updated_at,
          accepted_at,
          approved_via,
          account_id,
          original_subtotal,
          original_tax,
          original_discount,
          original_total,
          original_notes,
          has_pending_changes,
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
            change_order_type,
            change_order_approved
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

      const { data: estimateVersions } = await supabase
        .from("estimate_versions")
        .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: true });

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
            estimate_versions: estimateVersions || [],
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
      const body = await req.json();
      const { action } = body;
      const estimateVersionId = typeof body.estimate_version_id === "string" ? body.estimate_version_id : null;

      const { data: estimate, error: fetchError } = await supabase
        .from("estimates")
        .select("id, status, expires_at, job_id, has_pending_changes")
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

      if (action === "approve_changes" || action === "decline_changes") {
        if (!estimate.has_pending_changes) {
          return new Response(
            JSON.stringify({ error: "No pending changes to approve" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (action === "approve_changes") {
          const { error: approveError } = await supabase
            .from("estimate_line_items")
            .update({ change_order_approved: true })
            .eq("estimate_id", estimate.id)
            .eq("is_change_order", true)
            .eq("change_order_approved", false);

          if (approveError) {
            return new Response(
              JSON.stringify({ error: "Failed to approve changes" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: "Changes approved" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else {
          const { error: declineError } = await supabase
            .from("estimate_line_items")
            .delete()
            .eq("estimate_id", estimate.id)
            .eq("is_change_order", true)
            .eq("change_order_approved", false);

          if (declineError) {
            return new Response(
              JSON.stringify({ error: "Failed to decline changes" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: "Changes declined" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      if (action === "approve" || action === "decline") {
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

        if (action === "approve" && estimateVersionId) {
          const applyResult = await applyEstimateVersionBeforeApproval(
            supabase,
            estimate.id,
            estimateVersionId,
          );
          if (!applyResult.ok) {
            return new Response(
              JSON.stringify({ error: applyResult.error }),
              {
                status: applyResult.statusCode,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        const newStatus = action === "approve" ? "accepted" : "declined";
        const { error: updateError } = await supabase
          .from("estimates")
          .update({
            status: newStatus,
            accepted_at: action === "approve" ? new Date().toISOString() : null,
            approved_via: action === "approve" ? "customer_link" : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", estimate.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: `Failed to ${action} estimate` }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: `Estimate ${action === "approve" ? "approved" : "declined"}` }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        {
          status: 400,
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
