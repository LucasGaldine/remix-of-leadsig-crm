import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Payments from "@/pages/Payments";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/payments/EstimateCard", () => ({
  EstimateCard: () => null,
}));

vi.mock("@/components/payments/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));

vi.mock("@/components/payments/PaymentCard", () => ({
  PaymentCard: () => null,
}));

vi.mock("@/components/payments/ExportInvoicesModal", () => ({
  ExportInvoicesModal: ({ open }: { open: boolean }) => (open ? <div>export modal open</div> : null),
}));

vi.mock("@/components/payments/ExportHistoryModal", () => ({
  ExportHistoryModal: () => null,
}));

vi.mock("@/hooks/useEstimates", () => ({
  useEstimates: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePayments", () => ({
  usePayments: () => ({
    data: [],
    isLoading: false,
  }),
}));

describe("Payments export action", () => {
  it("uses a single FAB to open export modal and removes inline export card", () => {
    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/accounting export/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /past exports/i })).not.toBeInTheDocument();

    const exportFab = screen.getByRole("button", { name: /export data/i });
    expect(screen.queryByText(/export modal open/i)).not.toBeInTheDocument();

    fireEvent.click(exportFab);

    expect(screen.getByText(/export modal open/i)).toBeInTheDocument();
  });
});
