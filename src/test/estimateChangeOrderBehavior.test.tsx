import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import EstimateDetail from "@/pages/EstimateDetail";

const invalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

let estimateData: any;
let lineItemsResponse: any[] = [];

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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe("estimate change order behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    estimateData = {
      id: "est_1",
      status: "sent",
      subtotal: 100,
      customer: { id: "cust_1", name: "Taylor Smith", email: "taylor@example.com" },
      profit_margin: 0,
      tax_rate: 0,
      tax: 0,
      discount: 0,
      total: 100,
      notes: null,
      has_pending_changes: false,
      expires_at: "2026-04-10T00:00:00.000Z",
      accepted_at: null,
      approved_via: null,
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
          unit_price: 100,
          total: 100,
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

    lineItemsResponse = [];

    mockEq.mockReset();
    mockUpdate.mockReset();
    mockSelect.mockReset();
    mockFrom.mockImplementation((table: string) => {
      if (table === "estimate_line_items") {
        return {
          select: mockSelect.mockImplementation(() => ({
            eq: mockEq.mockImplementation(() => Promise.resolve({ data: lineItemsResponse, error: null })),
          })),
          update: mockUpdate.mockImplementation(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            })),
          })),
        };
      }

      if (table === "estimates") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
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

      return {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });
  });

  it("does not bulk-approve change orders during manual approve when only reorder-only edits exist", async () => {
    lineItemsResponse = [
      {
        id: "line_1",
        name: "Base item",
        description: null,
        quantity: 1,
        unit: "job",
        unit_price: 100,
        category: "labor",
        is_change_order: false,
        change_order_type: null,
        change_order_approved: null,
        original_line_item_id: null,
      },
      {
        id: "line_1_edit",
        name: "Base item",
        description: null,
        quantity: 1,
        unit: "job",
        unit_price: 100,
        category: "labor",
        is_change_order: true,
        change_order_type: "edited",
        change_order_approved: false,
        original_line_item_id: "line_1",
      },
    ];

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalled();
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalled();
  });
});
