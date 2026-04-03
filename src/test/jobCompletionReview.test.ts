import { describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL,
  isReviewRequestChecklistItem,
  shouldUsePortalFallback,
} from "@/lib/jobCompletionReview";

describe("jobCompletionReview", () => {
  it("matches the default review checklist label case-insensitively", () => {
    expect(DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL).toBe("Request review");
    expect(isReviewRequestChecklistItem("Request review")).toBe(true);
    expect(isReviewRequestChecklistItem(" request review ")).toBe(true);
    expect(isReviewRequestChecklistItem("Send client portal")).toBe(false);
  });

  it("uses portal fallback when twilio is unavailable or phone is missing", () => {
    expect(shouldUsePortalFallback(false, "5551231234")).toBe(true);
    expect(shouldUsePortalFallback(true, "")).toBe(true);
    expect(shouldUsePortalFallback(true, null)).toBe(true);
    expect(shouldUsePortalFallback(true, "5551231234")).toBe(false);
  });
});
