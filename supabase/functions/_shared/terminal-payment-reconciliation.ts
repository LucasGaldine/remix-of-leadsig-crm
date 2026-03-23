export type LocalPaymentStatus = "completed" | "failed";
export type TerminalPaymentStatus =
  | "terminal_pending"
  | "terminal_processing"
  | "completed"
  | "failed"
  | "canceled";
export type StripePaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

interface TerminalReconciliationOutcome {
  paymentStatus: LocalPaymentStatus | null;
  terminalStatus: TerminalPaymentStatus;
}

export function getTerminalCaptureOutcome(
  paymentIntentStatus: StripePaymentIntentStatus,
): TerminalReconciliationOutcome {
  switch (paymentIntentStatus) {
    case "succeeded":
      return {
        paymentStatus: "completed",
        terminalStatus: "completed",
      };
    case "processing":
    case "requires_capture":
      return {
        paymentStatus: null,
        terminalStatus: "terminal_processing",
      };
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return {
        paymentStatus: null,
        terminalStatus: "terminal_pending",
      };
    case "canceled":
      return {
        paymentStatus: "failed",
        terminalStatus: "canceled",
      };
    default:
      return {
        paymentStatus: "failed",
        terminalStatus: "failed",
      };
  }
}

export function getTerminalCancelOutcome(
  paymentIntentStatus: StripePaymentIntentStatus,
): TerminalReconciliationOutcome {
  if (paymentIntentStatus === "canceled") {
    return {
      paymentStatus: "failed",
      terminalStatus: "canceled",
    };
  }

  return {
    paymentStatus: "failed",
    terminalStatus: "failed",
  };
}

const terminalPaymentIntentStatuses = new Set<StripePaymentIntentStatus>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
]);

export function assertTerminalPaymentIntentStatus(
  paymentIntentStatus: string,
): StripePaymentIntentStatus {
  if (!terminalPaymentIntentStatuses.has(paymentIntentStatus as StripePaymentIntentStatus)) {
    throw new Error(`Unsupported PaymentIntent status: ${paymentIntentStatus}`);
  }

  return paymentIntentStatus as StripePaymentIntentStatus;
}

export function canCancelTerminalPaymentIntentStatus(
  paymentIntentStatus: StripePaymentIntentStatus,
): boolean {
  return paymentIntentStatus !== "succeeded" && paymentIntentStatus !== "canceled";
}
