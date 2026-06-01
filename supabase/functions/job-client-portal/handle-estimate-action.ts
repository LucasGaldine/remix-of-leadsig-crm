import {
  applyEstimateVersionBeforeApproval,
  pruneEstimateVersionsAfterApproval,
  restoreEstimateFromLatestApprovedSnapshot,
} from "./estimate-snapshot.ts";
import {
  isManualApprovalPhotoUrlColumnMissing,
  uploadSignatureDataUrl,
} from "./signature.ts";

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
  estimate: {
    id: string;
    status: string;
    expires_at: string | null;
    job_id: string | null;
    recurring_job_id?: string | null;
    updated_at: string;
    has_pending_changes?: boolean;
    account_id?: string | null;
    proposal_settings?: Record<string, unknown> | null;
  },
  action: "approve" | "decline" | "approve_changes" | "decline_changes",
  portalJobId: string | null,
  jsonResponse: (body: unknown, status?: number) => Response,
  clientUpdatedAt?: string,
  estimateVersionId?: string | null,
  signatureDataUrl?: string | null,
  agreementAcceptance?: Record<string, boolean> | null,
  agreementTemplates?: Record<string, unknown> | null,
  requiredDocumentConfigIds?: string[],
) {
  void portalJobId;
  const isWarrantyEnabledForVersion = (versionId: string | null | undefined) => {
    if (!versionId) return true;
    const settingsRaw = estimate?.proposal_settings?.version_warranty_enabled;
    const settings =
      settingsRaw && typeof settingsRaw === "object" && !Array.isArray(settingsRaw)
        ? (settingsRaw as Record<string, unknown>)
        : {};
    const value = settings[versionId];
    return value === undefined ? true : value === true;
  };

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
    const activeVersionId =
      estimateVersionId ||
      (typeof estimate?.proposal_settings?.recommended_version_id === "string"
        ? estimate.proposal_settings.recommended_version_id
        : null);
    const requiredAgreementKeys = ["job_agreement"];
    if (isWarrantyEnabledForVersion(activeVersionId)) {
      requiredAgreementKeys.push("warranty_agreement");
    }
    const acceptedKeys = requiredAgreementKeys.filter((key) => agreementAcceptance?.[key] === true);
    if (acceptedKeys.length !== requiredAgreementKeys.length) {
      return jsonResponse({ error: "All required agreements must be accepted before approval." }, 400);
    }
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
        job_agreement: agreementAcceptance?.job_agreement === true,
        warranty_agreement: agreementAcceptance?.warranty_agreement === true,
        accepted_at: new Date().toISOString(),
        ...acceptedDocumentConfigMap,
      },
      updated_at: new Date().toISOString(),
    };
    if (agreementTemplates && typeof agreementTemplates === "object") {
      const templates = agreementTemplates as Record<string, unknown>;
      estimateUpdatePayload.agreement_templates = {
        job_agreement: templates.job_agreement,
        warranty_agreement: templates.warranty_agreement,
      };
    }

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
