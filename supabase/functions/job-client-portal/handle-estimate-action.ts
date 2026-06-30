import {
  applyEstimateVersionBeforeApproval,
  pruneEstimateVersionsAfterApproval,
  restoreEstimateFromLatestApprovedSnapshot,
} from "./estimate-snapshot.ts";
import {
  isManualApprovalPhotoUrlColumnMissing,
  uploadSignatureDataUrl,
} from "./signature.ts";
import { fetchPortalDocumentsForLeadFamily } from "./portal-documents.ts";
import {
  persistSignedJobDocumentPdfs,
  resolveDocumentTemplateMergeFields,
  resolveUploadedDocumentForConfig,
} from "./signed-documents.ts";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function dispatchEstimateApprovalNotification(estimateId: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl) return;

    await fetch(`${supabaseUrl}/functions/v1/send-estimate-approval-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
      },
      body: JSON.stringify({ estimate_id: estimateId, event_type: "estimate_approved" }),
    });
  } catch (error) {
    console.error("Failed to dispatch estimate approval notifications:", error);
  }
}

export async function handleEstimateAction(
  supabase: any,
  supabaseUrl: string,
  estimate: {
    id: string;
    status: string;
    expires_at: string | null;
    job_id: string | null;
    recurring_job_id?: string | null;
    updated_at: string;
    has_pending_changes?: boolean;
    account_id?: string | null;
    customer_id?: string | null;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    total?: number | null;
    proposal_settings?: Record<string, unknown> | null;
  },
  action: "approve" | "decline" | "approve_changes" | "decline_changes",
  portalJobId: string | null,
  jsonResponse: (body: unknown, status?: number) => Response,
  clientUpdatedAt?: string,
  estimateVersionId?: string | null,
  signatureDataUrl?: string | null,
  agreementAcceptance?: Record<string, boolean> | null,
  requiredDocumentConfigIds?: string[],
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
    }

    const restoreResult = await restoreEstimateFromLatestApprovedSnapshot(supabase, estimate);
    if (!restoreResult.ok) {
      return jsonResponse({ error: restoreResult.error }, 500);
    }

    return jsonResponse({ success: true, message: "Changes declined" });
  }

  if (estimate.status === "accepted") {
    return jsonResponse({ error: "This estimate has already been approved" }, 400);
  }

  if (estimate.status === "declined") {
    return jsonResponse({ error: "This estimate has already been declined" }, 400);
  }

  if (estimate.expires_at && new Date(estimate.expires_at) < new Date()) {
    return jsonResponse({ error: "This estimate has expired" }, 400);
  }

  if (action === "approve") {
    const requiredConfigIds = (requiredDocumentConfigIds || []).filter((id) => typeof id === "string" && id.length > 0);
    const allRequiredConfigsAccepted = requiredConfigIds.every((id) => agreementAcceptance?.[id] === true);
    if (!allRequiredConfigsAccepted) {
      return jsonResponse({ error: "Please accept all required documents before approval." }, 400);
    }

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

    const acceptedDocumentConfigMap = Object.fromEntries(
      Object.entries(agreementAcceptance || {})
        .filter(([key, value]) => isUuid(key) && value === true)
        .map(([key]) => [key, true]),
    );

    const estimateUpdatePayload: Record<string, unknown> = {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      approved_via: "customer_link",
      agreement_acceptance: {
        accepted_at: new Date().toISOString(),
        ...acceptedDocumentConfigMap,
      },
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

    if (uploadedSignature && requiredConfigIds.length > 0) {
      const seedLeadIds = [estimate.job_id, portalJobId].filter((value): value is string => Boolean(value));
      const portalDocuments = await fetchPortalDocumentsForLeadFamily(
        supabase,
        supabaseUrl,
        seedLeadIds,
        "signed estimate approval documents",
      );
      const allConfigs = portalDocuments.configs || [];
      const allDocuments = portalDocuments.documents || [];
      const signedTargets = requiredConfigIds
        .map((configId) => {
          const config = allConfigs.find((row: any) => String(row?.id || "") === configId);
          if (!config) return null;
          return {
            config,
            uploadedDocument: resolveUploadedDocumentForConfig(config, allConfigs, allDocuments),
          };
        })
        .filter((target): target is { config: any; uploadedDocument: any | null } => Boolean(target));

      if (signedTargets.length > 0) {
        const accountId = String(estimate.account_id || "");
        const mergeFieldLeadId = portalDocuments.leadId || estimate.job_id || portalJobId || "";
        const { data: customer } = estimate.customer_id
          ? await supabase
              .from("customers")
              .select("id, name, email, phone")
              .eq("id", estimate.customer_id)
              .maybeSingle()
          : { data: null };
        const resolvedMergeFields = await resolveDocumentTemplateMergeFields({
          supabase,
          accountId,
          leadId: mergeFieldLeadId,
          estimateId: estimate.id,
        });
        const mergeFields = {
          current_date: new Date().toISOString().slice(0, 10),
          client_name: String(customer?.name || ""),
          client_email: String(customer?.email || ""),
          client_phone: String(customer?.phone || ""),
          estimate_total: `$${Number(estimate.total || 0).toFixed(2)}`,
          estimate_subtotal: `$${Number(estimate.subtotal || 0).toFixed(2)}`,
          estimate_tax: `$${Number(estimate.tax || 0).toFixed(2)}`,
          estimate_discount: `$${Number(estimate.discount || 0).toFixed(2)}`,
          ...resolvedMergeFields,
        };
        const persistResult = await persistSignedJobDocumentPdfs({
          supabase,
          supabaseUrl,
          accountId,
          acceptedAt: String(estimateUpdatePayload.accepted_at),
          signaturePublicUrl: uploadedSignature.publicUrl,
          customerName: String(customer?.name || "Customer"),
          mergeFields,
          targets: signedTargets,
        });
        if (!persistResult.ok) {
          return jsonResponse({ error: `Estimate approved, but ${persistResult.error}` }, 500);
        }
      }
    }

    const pruneResult = await pruneEstimateVersionsAfterApproval(
      supabase,
      estimate.id,
      estimateVersionId ?? null,
    );
    if (!pruneResult.ok) {
      console.error("Failed to prune estimate versions after approval:", pruneResult.error);
    }

    // Fallback dispatch in case database-triggered dispatch path fails.
    await dispatchEstimateApprovalNotification(estimate.id);

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
