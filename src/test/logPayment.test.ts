import { describe, expect, it, vi } from "vitest";

import { ensureInvoiceForLoggedPayment } from "@/lib/logPayment";

describe("ensureInvoiceForLoggedPayment", () => {
  it("creates an invoice when a logged tap to pay flow starts without one", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 42 });
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
          insert: vi.fn(() => ({
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
      rpc,
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
    expect(rpc).toHaveBeenCalledWith("get_next_invoice_number", {
      p_account_id: "acct_1",
    });
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
