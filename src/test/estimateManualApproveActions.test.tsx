import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import EstimateDetail from "@/pages/EstimateDetail";

const invalidateQueries = vi.fn().mockResolvedValue(undefined);
const estimateUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
const estimateUpdate = vi.fn(() => ({ eq: estimateUpdateEq }));
const lineItemsUpdateFinalEq = vi.fn(() => Promise.resolve({ error: null }));
const lineItemsUpdateEq2 = vi.fn(() => ({ eq: lineItemsUpdateFinalEq }));
const lineItemsUpdateEq1 = vi.fn(() => ({ eq: lineItemsUpdateEq2 }));
const lineItemsUpdate = vi.fn(() => ({ eq: lineItemsUpdateEq1 }));
const estimateVersionsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const estimateVersionsEq = vi.fn(() => ({ order: estimateVersionsOrder }));
const estimateVersionsSelect = vi.fn(() => ({ eq: estimateVersionsEq }));

let estimateData: any;

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/payments/EditEstimateModal", () => ({
  EditEstimateModal: () => null,
}));

vi.mock("@/components/jobs/JobInvoiceCard", () => ({
  JobInvoiceCard: () => <div>job invoice card</div>,
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateEstimatePDF: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ data: [] }),
}));

vi.mock("@/hooks/useEstimates", () => ({
  useEstimate: () => ({
    isLoading: false,
    data: estimateData,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "estimate_line_items") {
        return {
          update: lineItemsUpdate,
        };
      }

      if (table === "estimates") {
        return {
          update: estimateUpdate,
        };
      }

      if (table === "customers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "estimate_versions") {
        return {
          select: estimateVersionsSelect,
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      return {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    }),
  },
}));

describe("EstimateDetail manual approve actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estimateVersionsOrder.mockClear();
    estimateVersionsEq.mockClear();
    estimateVersionsSelect.mockClear();

    estimateData = {
      id: "est_1",
      status: "accepted",
      subtotal: 1200,
      customer: { id: "cust_1", name: "Taylor Smith", email: "taylor@example.com" },
      profit_margin: 0,
      tax_rate: 0.07,
      tax: 84,
      discount: 0,
      total: 1284,
      notes: null,
      has_pending_changes: true,
      expires_at: "2026-04-10T00:00:00.000Z",
      accepted_at: "2026-03-30T10:00:00.000Z",
      approved_via: "manual",
      job_id: "job_1",
      recurring_job_id: null,
      job: { id: "job_1", name: "Front Yard Renovation", status: "job" },
      recurring_job: null,
      line_items: [
        {
          id: "line_1",
          name: "Base item",
          description: null,
          category: "labor",
          quantity: 1,
          unit: "job",
          unit_price: 1200,
          total: 1200,
          sort_order: 0,
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
          changed_at: null,
        },
      ],
      original_total: null,
      original_line_items: null,
    };
  });

  it("reuses the approve button to manually approve pending change orders on accepted estimates", async () => {
    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /^approve$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(await screen.findByRole("heading", { name: /approve changes/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^approve changes$/i }));

    await waitFor(() => {
      expect(lineItemsUpdate).toHaveBeenCalledWith({ change_order_approved: true });
    });

    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        approved_via: "manual",
      }),
    );
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("does not show estimate versions load error when estimate_versions table is unavailable", async () => {
    estimateVersionsOrder.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.estimate_versions' in the schema cache",
      },
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /^approve$/i });

    await waitFor(() => {
      expect(estimateVersionsOrder).toHaveBeenCalled();
    });

    expect(toast.error).not.toHaveBeenCalledWith("Failed to load estimate versions");
  });
});
