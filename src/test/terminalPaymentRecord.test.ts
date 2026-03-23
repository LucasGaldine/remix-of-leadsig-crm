import { describe, expect, it } from "vitest";

import {
  buildPendingTerminalPaymentRecord,
  shouldRetryTerminalPaymentInsertWithoutTracking,
} from "../../supabase/functions/_shared/terminal-payment-record";

describe("buildPendingTerminalPaymentRecord", () => {
  const input = {
    invoiceId: "inv_1",
    customerId: "cust_1",
    jobId: "job_1",
    accountId: "acct_1",
    amount: 12.5,
    stripePaymentIntentId: "pi_1",
    stripeAccountId: "acct_stripe_1",
    stripeTerminalPaymentIntentStatus: "requires_payment_method",
    processedBy: "user_1",
  };

  it("includes terminal tracking fields by default", () => {
    expect(buildPendingTerminalPaymentRecord(input)).toMatchObject({
      payment_channel: "terminal",
      stripe_terminal_payment_intent_status: "requires_payment_method",
    });
  });

  it("can build a fallback insert without terminal tracking columns", () => {
    expect(buildPendingTerminalPaymentRecord(input, false)).not.toHaveProperty("payment_channel");
    expect(buildPendingTerminalPaymentRecord(input, false)).not.toHaveProperty("stripe_terminal_payment_intent_status");
  });
});

describe("shouldRetryTerminalPaymentInsertWithoutTracking", () => {
  it("retries when terminal tracking columns are missing", () => {
    expect(shouldRetryTerminalPaymentInsertWithoutTracking('Could not find the "payment_channel" column of "payments" in the schema cache')).toBe(true);
    expect(shouldRetryTerminalPaymentInsertWithoutTracking('column "stripe_terminal_payment_intent_status" of relation "payments" does not exist')).toBe(true);
  });

  it("does not retry for unrelated payment insert failures", () => {
    expect(shouldRetryTerminalPaymentInsertWithoutTracking("new row violates row-level security policy")).toBe(false);
  });
});
