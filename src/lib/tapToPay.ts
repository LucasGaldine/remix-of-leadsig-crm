export interface TapToPayPaymentSessionInput {
  amount: number;
  invoiceId?: string;
  customerId: string;
  jobId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
}

export interface TapToPayPaymentSessionRequest extends TapToPayPaymentSessionInput {
  channel: "terminal";
  paymentMethod: "tap-to-pay";
}

export interface TapToPayPaymentSessionResponse {
  clientSecret: string | null;
  invoiceId: string;
  paymentIntentId: string;
  paymentId: string | null;
  channel: "terminal";
  paymentMethod: "tap-to-pay";
  status: "terminal_pending";
}

export interface TapToPayHandoffInput {
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentIntentId: string;
  paymentId?: string | null;
  sessionId?: string | null;
}

export interface TapToPayHandoffPayload extends TapToPayHandoffInput {
  sessionId?: string;
}

export interface TapToPayDeepLinkInput {
  invoiceId: string;
  customerId?: string;
  amount?: number;
  paymentIntentId?: string;
  paymentId?: string | null;
  sessionId?: string | null;
}

export function buildTapToPayPayload(
  input: TapToPayPaymentSessionInput,
): TapToPayPaymentSessionRequest {
  return {
    ...input,
    channel: "terminal",
    paymentMethod: "tap-to-pay",
  };
}

export function buildTapToPayHandoffPayload(
  input: TapToPayHandoffInput,
): TapToPayHandoffPayload {
  return {
    ...input,
    sessionId: input.sessionId ?? input.paymentId ?? undefined,
  };
}

export function createTapToPayDeepLink(input: TapToPayDeepLinkInput): string {
  const params = new URLSearchParams({
    invoiceId: input.invoiceId,
  });

  if (input.customerId) {
    params.set("customerId", input.customerId);
  }

  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    params.set("amount", String(input.amount));
  }

  if (input.paymentIntentId) {
    params.set("paymentIntentId", input.paymentIntentId);
  }

  if (input.paymentId) {
    params.set("paymentId", input.paymentId);
  }

  const sessionId = input.sessionId ?? input.paymentId ?? undefined;
  if (sessionId) {
    params.set("sessionId", sessionId);
  }

  return `leadsig://tap-to-pay?${params.toString()}`;
}

export function isDirectTapToPayHandoffSupported(userAgent?: string): boolean {
  if (!userAgent) {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export function formatTapToPaySessionError(message: string): string {
  const remainingMatch = message.match(/Remaining:\s*(\$\d+(?:\.\d{1,2})?)/i);

  if (/would exceed estimate total/i.test(message) && remainingMatch?.[1]) {
    return `Tap to Pay amount exceeds the remaining estimate balance. Remaining available: ${remainingMatch[1]}. Lower the amount and try again.`;
  }

  return message;
}
