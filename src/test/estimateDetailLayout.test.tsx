import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import EstimateDetail from "@/pages/EstimateDetail";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/payments/EditEstimateModal", () => ({
  EditEstimateModal: () => null,
}));

vi.mock("@/components/payments/CreateInvoiceModal", () => ({
  CreateInvoiceModal: () => null,
}));

vi.mock("@/components/jobs/JobInvoiceCard", () => ({
  JobInvoiceCard: () => <div>job invoice card</div>,
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateEstimatePDF: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useEstimates", () => ({
  useEstimate: () => ({
    isLoading: false,
    data: {
      id: "est_1",
      status: "sent",
      subtotal: 1200,
      profit_margin: 0,
      tax_rate: 0.07,
      tax: 84,
      discount: 0,
      total: 1284,
      notes: "Customer requested premium materials.",
      has_pending_changes: true,
      expires_at: "2026-04-10T00:00:00.000Z",
      accepted_at: null,
      approved_via: null,
      job_id: "job_1",
      recurring_job_id: null,
      customer: { id: "cust_1", name: "Taylor Smith" },
      job: { id: "job_1", name: "Front Yard Renovation" },
      recurring_job: null,
      line_items: [
        {
          id: "line_1",
          name: "Paver installation",
          description: "Install pavers and compact base.",
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
        {
          id: "line_2",
          name: "Compactor rental",
          description: "Rental for plate compactor.",
          category: "equipment",
          quantity: 1,
          unit: "day",
          unit_price: 200,
          total: 200,
          sort_order: 1,
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
          changed_at: null,
        },
        {
          id: "line_3",
          name: "Paver materials",
          description: "Pavers and base stone.",
          category: "materials",
          quantity: 1,
          unit: "job",
          unit_price: 1000,
          total: 1000,
          sort_order: 2,
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
          changed_at: null,
        },
        {
          id: "line_4",
          name: "Jointing sand",
          description: "Polymeric sand for joints.",
          category: "materials",
          quantity: 1,
          unit: "bag",
          unit_price: 80,
          total: 80,
          sort_order: 3,
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
          changed_at: null,
        },
      ],
      original_total: 1200,
      original_line_items: [
        {
          id: "orig_line_1",
          name: "Original labor",
          description: "Original scope",
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
    },
  }),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({
    data: [
      {
        id: "inv_1",
        estimate_id: "est_1",
        invoice_number: 101,
        status: "sent",
        total: 640,
        balance_due: 640,
        due_date: "2026-04-05T00:00:00.000Z",
      },
    ],
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

describe("EstimateDetail layout", () => {
  it("uses a two-column detail layout and keeps quick actions in the header", async () => {
    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const headerActions = await screen.findByTestId("estimate-header-quick-actions");
    const summaryRow = screen.getByTestId("estimate-header-summary-row");
    const leftColumn = await screen.findByTestId("estimate-details-left-column");
    const rightColumn = screen.getByTestId("estimate-details-right-column");

    expect(within(summaryRow).getByRole("heading", { name: /^Estimate$/i })).toBeInTheDocument();
    expect(within(summaryRow).getByText("$1,284")).toBeInTheDocument();

    expect(within(leftColumn).getByRole("heading", { name: /line items/i })).toBeInTheDocument();
    expect(within(leftColumn).getByRole("heading", { name: /notes/i })).toBeInTheDocument();
    expect(within(leftColumn).getByText("Compactor rental")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Paver materials")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Jointing sand")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Paver installation")).toBeInTheDocument();
    expect(within(leftColumn).getByTestId("pending-changes-alert")).toBeInTheDocument();
    expect(
      within(leftColumn).queryByText(/changes have been sent to the customer for review/i),
    ).not.toBeInTheDocument();

    const categoryHeadings = within(leftColumn).getAllByTestId("line-item-category-heading");
    expect(categoryHeadings.map((heading) => heading.textContent)).toEqual(["Equipment", "Materials", "Labor"]);
    categoryHeadings.forEach((heading) => {
      expect(heading).toHaveClass("text-xs");
      expect(heading).toHaveClass("uppercase");
      expect(heading).toHaveClass("tracking-wide");
    });

    const materialsRow = within(leftColumn)
      .getByText("Paver materials")
      .closest("div.flex-1")
      ?.parentElement
      ?.parentElement as HTMLElement;
    expect(materialsRow).not.toHaveClass("border-b");
    expect(within(leftColumn).getByTestId("line-items-header-row")).not.toHaveClass("border-t");

    const compareTabs = within(leftColumn).getByRole("tablist");
    const pendingAlert = within(leftColumn).getByTestId("pending-changes-alert");
    expect(
      compareTabs.compareDocumentPosition(pendingAlert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(compareTabs).getByRole("tab", { name: /^Modified$/i })).toBeInTheDocument();
    expect(within(compareTabs).getByRole("tab", { name: /^Original$/i })).toBeInTheDocument();

    const originalTab = within(compareTabs).getByRole("tab", { name: /^Original$/i });
    fireEvent.mouseDown(originalTab);
    fireEvent.click(originalTab);
    expect(within(leftColumn).queryByTestId("pending-changes-alert")).not.toBeInTheDocument();
    const approvedHeading = within(leftColumn).getByText("Approved");
    expect(approvedHeading).toBeInTheDocument();
    expect(
      compareTabs.compareDocumentPosition(approvedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(headerActions).toHaveClass("flex-nowrap");
    expect(within(headerActions).getByRole("button", { name: /^Approve$/i })).toBeInTheDocument();
    expect(within(headerActions).getByRole("button", { name: /^Client Portal$/i })).toBeInTheDocument();
    expect(within(headerActions).getByRole("button", { name: /^Download$/i })).toBeInTheDocument();

    expect(within(rightColumn).getByText("Client")).toBeInTheDocument();
    expect(within(rightColumn).getByText("job invoice card")).toBeInTheDocument();
  });
});
