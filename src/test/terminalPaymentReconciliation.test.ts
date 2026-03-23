import { describe, expect, it } from "vitest";

import {
  assertTerminalPaymentIntentStatus,
  canCancelTerminalPaymentIntentStatus,
  getTerminalCaptureOutcome,
  getTerminalCancelOutcome,
} from "../../supabase/functions/_shared/terminal-payment-reconciliation";

describe("terminal payment reconciliation", () => {
  it("marks succeeded Stripe intents as completed captures", () => {
    expect(getTerminalCaptureOutcome("succeeded")).toEqual({
      paymentStatus: "completed",
      terminalStatus: "completed",
    });
  });

  it("keeps non-final Stripe intents out of the completed state", () => {
    expect(getTerminalCaptureOutcome("processing")).toEqual({
      paymentStatus: null,
      terminalStatus: "terminal_processing",
    });
  });

  it("keeps requires-capture intents out of the failed state", () => {
    expect(getTerminalCaptureOutcome("requires_capture")).toEqual({
      paymentStatus: null,
      terminalStatus: "terminal_processing",
    });
  });

  it("treats canceled Stripe intents as failed local rows when canceling", () => {
    expect(getTerminalCancelOutcome("canceled")).toEqual({
      paymentStatus: "failed",
      terminalStatus: "canceled",
    });
  });

  it("treats non-canceled terminal cancel fallbacks as failed", () => {
    expect(getTerminalCancelOutcome("requires_payment_method")).toEqual({
      paymentStatus: "failed",
      terminalStatus: "failed",
    });
  });

  it("rejects unsupported Stripe PaymentIntent statuses", () => {
    expect(() => assertTerminalPaymentIntentStatus("unexpected_status")).toThrow(
      "Unsupported PaymentIntent status",
    );
  });

  it("does not allow canceling already-succeeded intents", () => {
    expect(canCancelTerminalPaymentIntentStatus("succeeded")).toBe(false);
  });
});
