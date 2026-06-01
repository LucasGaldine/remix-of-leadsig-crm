import { supabase } from "@/integrations/supabase/client";

const MAX_SIGNATURE_IMAGE_BYTES = 6 * 1024 * 1024;

function isManualApprovalPhotoColumnMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

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

  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (!bytes.length || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) {
    return null;
  }

  return { bytes, contentType, extension };
}

export async function approveEstimateManuallyById(estimateId: string, signatureDataUrl?: string) {
  const nowIso = new Date().toISOString();
  let uploadedSignature: { filePath: string; publicUrl: string } | null = null;

  if (signatureDataUrl) {
    const parsedImage = parseSignatureDataUrl(signatureDataUrl);
    if (!parsedImage) {
      throw new Error("Invalid signature format");
    }

    const filePath = `estimate-approvals/${estimateId}/${crypto.randomUUID()}.${parsedImage.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("lead-photos")
      .upload(filePath, parsedImage.bytes, {
        contentType: parsedImage.contentType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("lead-photos").getPublicUrl(filePath);
    uploadedSignature = { filePath, publicUrl: urlData.publicUrl };
  }

  const estimateUpdatePayload: Record<string, unknown> = {
    status: "accepted",
    approved_via: uploadedSignature?.publicUrl ? "manual_signature" : "manual",
    accepted_at: nowIso,
    updated_at: nowIso,
  };

  if (uploadedSignature?.publicUrl) {
    estimateUpdatePayload.manual_approval_photo_url = uploadedSignature.publicUrl;
  }

  const { error } = await supabase
    .from("estimates")
    .update(estimateUpdatePayload)
    .eq("id", estimateId);

  if (error && uploadedSignature?.publicUrl && isManualApprovalPhotoColumnMissing(error)) {
    const { manual_approval_photo_url: _manualApprovalPhotoUrl, ...fallbackPayload } = estimateUpdatePayload;
    const { error: fallbackError } = await supabase
      .from("estimates")
      .update(fallbackPayload)
      .eq("id", estimateId);

    const { error: removeError } = await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
    if (removeError) {
      console.error("Failed to remove unlinked manual approval photo:", removeError);
    }

    if (fallbackError) throw fallbackError;
    return;
  }

  if (error) {
    if (uploadedSignature?.filePath) {
      const { error: removeError } = await supabase.storage.from("lead-photos").remove([uploadedSignature.filePath]);
      if (removeError) {
        console.error("Failed to remove failed manual approval photo upload:", removeError);
      }
    }
    throw error;
  }

  try {
    if (supabase.functions?.invoke) {
      await supabase.functions.invoke("send-estimate-approval-notifications", {
        body: { estimate_id: estimateId, event_type: "estimate_approved" },
      });
    }
  } catch (dispatchError) {
    console.error("Failed to dispatch estimate approval notifications:", dispatchError);
  }
}

export async function approveLatestEstimateForJob(jobId: string) {
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id")
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (estimateError) throw estimateError;
  if (!estimate?.id) throw new Error("No estimate found for this job");

  await approveEstimateManuallyById(estimate.id);
}
