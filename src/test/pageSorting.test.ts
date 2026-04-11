import { describe, expect, it } from "vitest";
import {
  sortCustomerItems,
  sortEstimateItems,
  sortInvoiceItems,
  sortJobItems,
  sortLeadItems,
  sortPaymentItems,
  type CustomerSortOption,
  type EstimateSortOption,
  type InvoiceSortOption,
  type JobSortOption,
  type LeadSortOption,
  type PaymentSortOption,
} from "@/lib/pageSorting";

describe("sortLeadItems", () => {
  const leads = [
    { id: "1", name: "Charlie", estimatedBudget: 200, createdAtRaw: "2026-02-01T10:00:00.000Z" },
    { id: "2", name: "alice", estimatedBudget: 100, createdAtRaw: "2026-03-01T10:00:00.000Z" },
    { id: "3", name: "Bob", estimatedBudget: 400, createdAtRaw: "2026-01-01T10:00:00.000Z" },
  ];

  it("sorts by newest first", () => {
    const sorted = sortLeadItems(leads, "newest");
    expect(sorted.map((lead) => lead.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by oldest first", () => {
    const sorted = sortLeadItems(leads, "oldest");
    expect(sorted.map((lead) => lead.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts alphabetically", () => {
    const sorted = sortLeadItems(leads, "name_asc");
    expect(sorted.map((lead) => lead.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by value descending", () => {
    const sorted = sortLeadItems(leads, "value_desc");
    expect(sorted.map((lead) => lead.id)).toEqual(["3", "1", "2"]);
  });
});

describe("sortJobItems", () => {
  const jobs = [
    { id: "1", name: "B Job", created_at: "2026-02-01T10:00:00.000Z", scheduled_date: "2026-04-10", last_scheduled_date: "2026-04-10" },
    { id: "2", name: "A Job", created_at: "2026-03-01T10:00:00.000Z", scheduled_date: "2026-04-08", last_scheduled_date: "2026-04-08" },
    { id: "3", name: "C Job", created_at: "2026-01-01T10:00:00.000Z", scheduled_date: null, last_scheduled_date: null },
  ];

  it("sorts by soonest scheduled date with unscheduled last", () => {
    const sorted = sortJobItems(jobs, "scheduled_soonest");
    expect(sorted.map((job) => job.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by latest scheduled date with unscheduled last", () => {
    const sorted = sortJobItems(jobs, "scheduled_latest");
    expect(sorted.map((job) => job.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by name descending", () => {
    const sorted = sortJobItems(jobs, "name_desc");
    expect(sorted.map((job) => job.id)).toEqual(["3", "1", "2"]);
  });
});

describe("sortEstimateItems", () => {
  const estimates = [
    { id: "1", created_at: "2026-02-01T10:00:00.000Z", total: 200, customer: { name: "Beta" }, job: { name: "Two" } },
    { id: "2", created_at: "2026-03-01T10:00:00.000Z", total: 100, customer: { name: "alpha" }, job: { name: "One" } },
    { id: "3", created_at: "2026-01-01T10:00:00.000Z", total: 400, customer: null, job: null },
  ];

  it("sorts by total descending", () => {
    const sorted = sortEstimateItems(estimates, "total_desc");
    expect(sorted.map((estimate) => estimate.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by customer name ascending", () => {
    const sorted = sortEstimateItems(estimates, "customer_asc");
    expect(sorted.map((estimate) => estimate.id)).toEqual(["2", "1", "3"]);
  });

  it("keeps newest default order", () => {
    const sorted = sortEstimateItems(estimates, "newest");
    expect(sorted.map((estimate) => estimate.id)).toEqual(["2", "1", "3"]);
  });
});

describe("sortInvoiceItems", () => {
  const invoices = [
    { id: "1", created_at: "2026-02-01T10:00:00.000Z", total: 200, customer: { name: "Beta" } },
    { id: "2", created_at: "2026-03-01T10:00:00.000Z", total: 100, customer: { name: "alpha" } },
    { id: "3", created_at: "2026-01-01T10:00:00.000Z", total: 400, customer: null },
  ];

  it("sorts invoices by amount descending", () => {
    const sorted = sortInvoiceItems(invoices, "amount_desc");
    expect(sorted.map((invoice) => invoice.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts invoices by customer name ascending", () => {
    const sorted = sortInvoiceItems(invoices, "customer_asc");
    expect(sorted.map((invoice) => invoice.id)).toEqual(["2", "1", "3"]);
  });
});

describe("sortPaymentItems", () => {
  const payments = [
    { id: "1", created_at: "2026-02-01T10:00:00.000Z", amount: 200, customer: { name: "Beta" } },
    { id: "2", created_at: "2026-03-01T10:00:00.000Z", amount: 100, customer: { name: "alpha" } },
    { id: "3", created_at: "2026-01-01T10:00:00.000Z", amount: 400, customer: null },
  ];

  it("sorts payments by amount ascending", () => {
    const sorted = sortPaymentItems(payments, "amount_asc");
    expect(sorted.map((payment) => payment.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts payments by customer name descending", () => {
    const sorted = sortPaymentItems(payments, "customer_desc");
    expect(sorted.map((payment) => payment.id)).toEqual(["1", "2", "3"]);
  });
});

describe("sortCustomerItems", () => {
  const customers = [
    { id: "1", name: "Beta", created_at: "2026-02-01T10:00:00.000Z" },
    { id: "2", name: "alpha", created_at: "2026-03-01T10:00:00.000Z" },
    { id: "3", name: "Gamma", created_at: "2026-01-01T10:00:00.000Z" },
  ];

  it("sorts customers by name ascending", () => {
    const sorted = sortCustomerItems(customers, "name_asc");
    expect(sorted.map((customer) => customer.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts customers by oldest first", () => {
    const sorted = sortCustomerItems(customers, "oldest");
    expect(sorted.map((customer) => customer.id)).toEqual(["3", "1", "2"]);
  });
});

void ({} as LeadSortOption);
void ({} as JobSortOption);
void ({} as EstimateSortOption);
void ({} as InvoiceSortOption);
void ({} as PaymentSortOption);
void ({} as CustomerSortOption);
