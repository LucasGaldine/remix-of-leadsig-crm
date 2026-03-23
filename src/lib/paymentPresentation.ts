import type {
  PaymentChannel,
  PaymentMethod,
  PaymentStatus,
  TerminalStatusValue,
} from "@/types/payments";

type PaymentMethodLike = PaymentMethod | "tap_to_pay";

export type PaymentStatusTone = "pending" | "confirmed" | "attention" | "neutral";

export interface PaymentStatusDisplay {
  label: string;
  tone: PaymentStatusTone;
  icon: "clock" | "check" | "x-circle" | "rotate-ccw";
}

function isTerminalPaymentContext(
  terminalStatus?: TerminalStatusValue,
  paymentChannel?: PaymentChannel,
): boolean {
  return paymentChannel === "terminal" || typeof terminalStatus === "string";
}

export function getPaymentMethodLabel(method: PaymentMethodLike): string {
  switch (method) {
    case "card":
      return "Credit Card";
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "ach":
      return "ACH Transfer";
    case "tap-to-pay":
    case "tap_to_pay":
      return "Tap to Pay";
    default:
      return method;
  }
}

export function getPaymentStatusDisplay(
  status: PaymentStatus,
  terminalStatus?: TerminalStatusValue,
  paymentChannel?: PaymentChannel,
): PaymentStatusDisplay {
  if (status === "refunded") {
    return { label: "Refunded", tone: "neutral", icon: "rotate-ccw" };
  }

  if (status === "completed") {
    return { label: "Completed", tone: "confirmed", icon: "check" };
  }

  if (status === "failed" && terminalStatus !== "canceled") {
    return { label: "Failed", tone: "attention", icon: "x-circle" };
  }

  if (isTerminalPaymentContext(terminalStatus, paymentChannel)) {
    switch (terminalStatus) {
      case "terminal_processing":
      case "processing":
      case "requires_capture":
        return {
          label: "Terminal Processing",
          tone: "pending",
          icon: "clock",
        };
      case "terminal_pending":
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return {
          label: "Terminal Pending",
          tone: "pending",
          icon: "clock",
        };
      case "canceled":
        return {
          label: "Canceled",
          tone: "neutral",
          icon: "x-circle",
        };
      case "completed":
      case "succeeded":
        return {
          label: "Completed",
          tone: "confirmed",
          icon: "check",
        };
      case "failed":
        return {
          label: "Failed",
          tone: "attention",
          icon: "x-circle",
        };
      default:
        break;
    }
  }

  switch (status) {
    case "failed":
      return { label: "Failed", tone: "attention", icon: "x-circle" };
    case "pending":
    default:
      return { label: "Pending", tone: "pending", icon: "clock" };
  }
}
