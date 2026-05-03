import { describe, expect, it, vi } from "vitest";

import {
  ensureInvoiceForLoggedPayment,
  recordLoggedPaymentAgainstInvoice,
  reconcileInvoiceForLoggedPayment,
  selectInvoiceForLoggedPayment,
} from "@/lib/logPayment";

describe("ensureInvoiceForLoggedPayment", () => {
  it("creates a paid invoice when a logged payment starts without one", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { invoice_number: 42 }, error: null });
    const invoiceInsert = vi.fn();
    const invoiceInsertSingle = vi.fn().mockResolvedValue({
      data: { id: "inv_new" },
      error: null,
    });
    const lineItemInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string) => {
      if (table === "estimates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "est_1" } }),
            })),
          })),
        };
      }

      if (table === "invoices") {
        return {
          insert: invoiceInsert.mockImplementation(() => ({
            select: vi.fn(() => ({
              single: invoiceInsertSingle,
            })),
          })),
        };
      }

      if (table === "invoice_line_items") {
        return {
          insert: lineItemInsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const supabase = {
      from,
      functions: { invoke },
    };

    const invoiceId = await ensureInvoiceForLoggedPayment({
      supabase,
      existingInvoiceId: null,
      customerId: "cust_1",
      jobId: "job_1",
      accountId: "acct_1",
      userId: "user_1",
      amount: 249.5,
      methodLabel: "Tap to Pay",
    });

    expect(invoiceId).toBe("inv_new");
    expect(invoke).toHaveBeenCalledWith("secure-invoice-number", {
      body: {
        account_id: "acct_1",
      },
    });
    expect(invoiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        balance_due: 0,
        status: "paid",
      }),
    );
    expect(invoiceInsertSingle).toHaveBeenCalled();
    expect(lineItemInsert).toHaveBeenCalledWith({
      invoice_id: "inv_new",
      name: "Payment - Tap to Pay",
      description: "Payment received via Tap to Pay",
      quantity: 1,
      unit: "item",
      unit_price: 249.5,
      total: 249.5,
      sort_order: 0,
      account_id: "acct_1",
    });
  });
});

describe("reconcileInvoiceForLoggedPayment", () => {
  it("marks an existing invoice partial when a logged payment does not cover the full balance", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({
      eq: updateEq,
    }));
    const from = vi.fn((table: string) => {
      if (table === "invoices") {
        return {
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await reconcileInvoiceForLoggedPayment({
      supabase: { from },
      invoiceId: "inv_existing",
      balanceDue: 200,
      paymentAmount: 50,
    });

    expect(update).toHaveBeenCalledWith({
      balance_due: 150,
      status: "partial",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "inv_existing");
  });

  it("marks an existing invoice paid when a logged payment clears the balance", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({
      eq: updateEq,
    }));
    const from = vi.fn((table: string) => {
      if (table === "invoices") {
        return {
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await reconcileInvoiceForLoggedPayment({
      supabase: { from },
      invoiceId: "inv_existing",
      balanceDue: 200,
      paymentAmount: 200,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        balance_due: 0,
        status: "paid",
      }),
    );
    expect(updateEq).toHaveBeenCalledWith("id", "inv_existing");
  });
});

describe("recordLoggedPaymentAgainstInvoice", () => {
  it("syncs offline payments to Stripe before recording a payment against a Stripe invoice", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const paymentInsert = vi.fn().mockResolvedValue({ error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({
      eq: updateEq,
    }));
    const from = vi.fn((table: string) => {
      if (table === "payments") {
        return {
          insert: paymentInsert,
        };
      }

      if (table === "invoices") {
        return {
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await recordLoggedPaymentAgainstInvoice({
      supabase: { from, functions: { invoke } },
      invoice: {
        id: "inv_stripe",
        customer_id: "cust_1",
        lead_id: "job_1",
        account_id: "acct_1",
        balance_due: 125,
        stripe_invoice_id: "in_stripe_123",
      },
      paymentAmount: 125,
      method: "check",
      methodLabel: "Check",
      userId: "user_1",
    });

    expect(invoke).toHaveBeenCalledWith("stripe-record-offline-invoice-payment", {
      body: {
        invoiceId: "inv_stripe",
        amount: 125,
        method: "check",
      },
    });
    expect(paymentInsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects partial offline payments for Stripe invoices", async () => {
    const invoke = vi.fn();
    const from = vi.fn();

    await expect(
      recordLoggedPaymentAgainstInvoice({
      supabase: { from, functions: { invoke } },
        invoice: {
          id: "inv_stripe",
          customer_id: "cust_1",
          lead_id: "job_1",
          account_id: "acct_1",
          balance_due: 125,
          stripe_invoice_id: "in_stripe_123",
        },
        paymentAmount: 50,
        method: "check",
        methodLabel: "Check",
        userId: "user_1",
      }),
    ).rejects.toThrow("Stripe invoice offline payments must match the remaining balance");

    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("selectInvoiceForLoggedPayment", () => {
  it("prefers the newest open invoice over a newer paid invoice", () => {
    expect(
      selectInvoiceForLoggedPayment([
        {
          id: "inv_paid",
          status: "paid",
          balance_due: 0,
          created_at: "2026-03-23T12:00:00.000Z",
        },
        {
          id: "inv_sent",
          status: "sent",
          balance_due: 100,
          created_at: "2026-03-23T11:00:00.000Z",
        },
      ]),
    ).toEqual({
      id: "inv_sent",
      status: "sent",
      balance_due: 100,
      created_at: "2026-03-23T11:00:00.000Z",
    });
  });

  it("returns null when every existing invoice is already closed", () => {
    expect(
      selectInvoiceForLoggedPayment([
        {
          id: "inv_paid",
          status: "paid",
          balance_due: 0,
          created_at: "2026-03-23T12:00:00.000Z",
        },
      ]),
    ).toBeNull();
  });
});
