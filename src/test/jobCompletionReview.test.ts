import { describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL,
  shouldShowReviewRequestCard,
  isTwilioNotConfiguredErrorMessage,
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

  it("detects twilio-not-configured errors case-insensitively", () => {
    expect(isTwilioNotConfiguredErrorMessage("Twilio credentials not configured")).toBe(true);
    expect(isTwilioNotConfiguredErrorMessage("TWILIO CREDENTIALS NOT CONFIGURED")).toBe(true);
    expect(isTwilioNotConfiguredErrorMessage("network timeout")).toBe(false);
    expect(isTwilioNotConfiguredErrorMessage(undefined)).toBe(false);
  });

  it("shows the review request only when the job is completed and not dismissed", () => {
    expect(shouldShowReviewRequestCard("Completed", false)).toBe(true);
    expect(shouldShowReviewRequestCard("Completed", true)).toBe(false);
    expect(shouldShowReviewRequestCard("In Progress", false)).toBe(false);
    expect(shouldShowReviewRequestCard("Paid", false)).toBe(false);
  });
});
