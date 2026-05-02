const MAX_SIGNATURE_IMAGE_BYTES = 6 * 1024 * 1024;

export function isManualApprovalPhotoUrlColumnMissing(error: unknown): boolean {
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

export async function uploadSignatureDataUrl(
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
