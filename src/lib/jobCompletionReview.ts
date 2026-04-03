export const DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL = "Request review";
export const SEND_CLIENT_PORTAL_CHECKLIST_LABEL = "Send client portal";

export function normalizeChecklistLabel(label: string | null | undefined) {
  return (label || "").trim().toLowerCase();
}

export function isReviewRequestChecklistItem(label: string | null | undefined) {
  return normalizeChecklistLabel(label) === DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL.toLowerCase();
}

export function shouldUsePortalFallback(hasTwilioConfigured: boolean, customerPhone?: string | null) {
  if (!hasTwilioConfigured) return true;
  return !customerPhone?.trim();
}
