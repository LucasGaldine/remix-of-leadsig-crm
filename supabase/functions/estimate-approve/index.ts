import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function restoreEstimateFromLatestApprovedSnapshot(
  supabase: any,
  estimate: {
    id: string;
    account_id?: string | null;
    proposal_settings?: Record<string, unknown> | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshotRaw =
    estimate.proposal_settings &&
    typeof estimate.proposal_settings === "object" &&
    estimate.proposal_settings.latest_approved_snapshot &&
    typeof estimate.proposal_settings.latest_approved_snapshot === "object"
      ? (estimate.proposal_settings.latest_approved_snapshot as Record<string, unknown>)
      : null;

  if (!snapshotRaw) {
    const { error: fallbackDeleteError } = await supabase
      .from("estimate_line_items")
      .delete()
      .eq("estimate_id", estimate.id)
      .eq("is_change_order", true)
      .eq("change_order_approved", false);

    if (fallbackDeleteError) {
      return { ok: false, error: "Failed to decline changes" };
    }

    const { error: fallbackEstimateUpdateError } = await supabase
      .from("estimates")
      .update({
        has_pending_changes: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (fallbackEstimateUpdateError) {
      return { ok: false, error: "Failed to finalize declined changes" };
    }

    return { ok: true };
  }

  const snapshotLineItems = Array.isArray(snapshotRaw.line_items) ? snapshotRaw.line_items : [];

  const { error: deleteAllLineItemsError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimate.id);

  if (deleteAllLineItemsError) {
    return { ok: false, error: "Failed to restore estimate after declining changes" };
  }

  if (snapshotLineItems.length > 0) {
    const restoreLineItems = snapshotLineItems.map((item: any, index: number) => ({
      estimate_id: estimate.id,
      account_id: estimate.account_id ?? null,
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

    const { error: restoreLineItemsError } = await supabase
      .from("estimate_line_items")
      .insert(restoreLineItems);

    if (restoreLineItemsError) {
      return { ok: false, error: "Failed to restore estimate after declining changes" };
    }
  }

  const { error: restoreEstimateError } = await supabase
    .from("estimates")
    .update({
      subtotal: Number(snapshotRaw.subtotal) || 0,
      tax_rate: Number(snapshotRaw.tax_rate) || 0,
      tax: Number(snapshotRaw.tax) || 0,
      discount: Number(snapshotRaw.discount) || 0,
      total: Number(snapshotRaw.total) || 0,
      has_pending_changes: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);

  if (restoreEstimateError) {
    return { ok: false, error: "Failed to restore estimate after declining changes" };
  }

  return { ok: true };
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
          proposal_settings,
          project_visualization_image_url,
          agreement_templates,
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
        .select("company_name, company_email, company_phone, logo_url, settings")
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
      const estimateVersionId = typeof body.estimate_version_id === "string" ? body.estimate_version_id : null;

      const { data: estimate, error: fetchError } = await supabase
        .from("estimates")
        .select("id, status, expires_at, job_id, has_pending_changes, account_id, proposal_settings, agreement_templates")
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
          const restoreResult = await restoreEstimateFromLatestApprovedSnapshot(supabase, estimate);
          if (!restoreResult.ok) {
            return new Response(
              JSON.stringify({ error: restoreResult.error }),
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

        if (action === "approve") {
          const requiredAgreementKeys = [
            "job_release_agreement",
            "job_agreement",
            "warranty_agreement",
          ];
          const acceptedKeys = requiredAgreementKeys.filter((key) => agreementAcceptance?.[key] === true);
          if (acceptedKeys.length !== requiredAgreementKeys.length) {
            return new Response(
              JSON.stringify({ error: "All required agreements must be accepted before approval." }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        let uploadedSignature: { filePath: string; publicUrl: string } | null = null;
        if (action === "approve" && signatureDataUrl) {
          const uploadedResult = await uploadSignatureDataUrl(supabase, estimate.id, signatureDataUrl);
          if (!uploadedResult.ok) {
            return new Response(
              JSON.stringify({ error: uploadedResult.error }),
              {
                status: uploadedResult.statusCode,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          uploadedSignature = { filePath: uploadedResult.filePath, publicUrl: uploadedResult.publicUrl };
        }

        const newStatus = action === "approve" ? "accepted" : "declined";
        const estimateUpdatePayload: Record<string, unknown> = {
          status: newStatus,
          accepted_at: action === "approve" ? new Date().toISOString() : null,
          approved_via: action === "approve" ? "customer_link" : null,
          agreement_acceptance:
            action === "approve"
              ? {
                  job_release_agreement: agreementAcceptance?.job_release_agreement === true,
                  job_agreement: agreementAcceptance?.job_agreement === true,
                  warranty_agreement: agreementAcceptance?.warranty_agreement === true,
                  accepted_at: new Date().toISOString(),
                }
              : null,
          updated_at: new Date().toISOString(),
        };

        if (uploadedSignature) {
          estimateUpdatePayload.manual_approval_photo_url = uploadedSignature.publicUrl;
        }

        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateUpdatePayload)
          .eq("id", estimate.id);

        if (updateError && uploadedSignature && isManualApprovalPhotoUrlColumnMissing(updateError)) {
          const { manual_approval_photo_url: _manualApprovalPhotoUrl, ...fallbackPayload } = estimateUpdatePayload;
          const { error: fallbackError } = await supabase
            .from("estimates")
            .update(fallbackPayload)
            .eq("id", estimate.id);

          if (uploadedSignature.filePath) {
            await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
          }

          if (fallbackError) {
            return new Response(
              JSON.stringify({ error: `Failed to ${action} estimate` }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        } else if (updateError) {
          if (uploadedSignature?.filePath) {
            await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
          }
          return new Response(
            JSON.stringify({ error: `Failed to ${action} estimate` }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (action === "approve") {
          const pruneResult = await pruneEstimateVersionsAfterApproval(
            supabase,
            estimate.id,
            estimateVersionId,
          );
          if (!pruneResult.ok) {
            console.error("Failed to prune estimate versions after approval:", pruneResult.error);
          }
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
