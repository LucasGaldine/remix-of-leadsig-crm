import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import InvoiceDetail from "@/pages/InvoiceDetail";

const { generateInvoicePDF } = vi.hoisted(() => ({
  generateInvoicePDF: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateInvoicePDF,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      company_name: "LeadSig",
      company_email: "hello@example.com",
      company_phone: "555-1234",
      logo_url: "https://example.com/logo.png",
    },
  }),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoice: () => ({
    isLoading: false,
    data: {
      id: "inv_1",
      invoice_number: 42,
      status: "sent",
      total: 2675,
      balance_due: 2675,
      subtotal: 2500,
      tax_rate: 0.07,
      tax: 175,
      discount: 0,
      due_date: "2026-03-31T00:00:00.000Z",
      created_at: "2026-03-23T00:00:00.000Z",
      notes: "Thank you",
      customer_id: "cust_1",
      lead_id: "lead_1",
      account_id: "acct_1",
      customer: { name: "Taylor Smith", email: "taylor@example.com", address: "1 Main St" },
      job: { name: "Patio Build" },
      line_items: [
        {
          id: "line_1",
          name: "Patio",
          description: "Install pavers",
          quantity: 1,
          unit: "job",
          unit_price: 2500,
          total: 2500,
        },
      ],
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe("InvoiceDetail pdf download", () => {
  it("downloads a branded invoice PDF from the invoice detail page", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/payments/invoices/inv_1"]}>
        <Routes>
          <Route path="/payments/invoices/:id" element={<InvoiceDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const downloadButton = screen.getByRole("button", { name: /Download PDF/i });
    const copyPayLinkButton = screen.getByRole("button", { name: /Copy Pay Link/i });
    expect(
      downloadButton.compareDocumentPosition(copyPayLinkButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(generateInvoicePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: "Taylor Smith",
          companyName: "LeadSig",
          companyLogoUrl: "https://example.com/logo.png",
          invoiceNumber: 42,
          balanceDue: 2675,
        }),
      );
    });
  });
});
