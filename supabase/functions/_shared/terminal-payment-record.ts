interface PendingTerminalPaymentRecordInput {
  invoiceId: string;
  customerId: string;
  jobId?: string;
  accountId: string;
  amount: number;
  stripePaymentIntentId: string;
  stripeAccountId: string;
  stripeTerminalPaymentIntentStatus: string;
  processedBy: string;
}

export function buildPendingTerminalPaymentRecord(
  input: PendingTerminalPaymentRecordInput,
  includeTerminalTracking = true,
) {
  const baseRecord = {
    invoice_id: input.invoiceId,
    customer_id: input.customerId,
    lead_id: input.jobId,
    account_id: input.accountId,
    amount: input.amount,
    method: "tap-to-pay",
    status: "pending",
    stripe_payment_intent_id: input.stripePaymentIntentId,
    stripe_account_id: input.stripeAccountId,
    processed_by: input.processedBy,
  };

  if (!includeTerminalTracking) {
    return baseRecord;
  }

  return {
    ...baseRecord,
    payment_channel: "terminal",
    stripe_terminal_payment_intent_status: input.stripeTerminalPaymentIntentStatus,
  };
}

export function shouldRetryTerminalPaymentInsertWithoutTracking(message?: string | null): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes("payment_channel") ||
    message.includes("stripe_terminal_payment_intent_status") ||
    message.toLowerCase().includes("schema cache")
  );
}
