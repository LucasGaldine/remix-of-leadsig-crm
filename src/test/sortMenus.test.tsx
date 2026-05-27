import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Jobs from "@/pages/Jobs";
import Leads from "@/pages/Leads";
import Payments from "@/pages/Payments";
import Customers from "@/pages/Customers";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/layout/FloatingActionButton", () => ({
  FloatingActionButton: () => null,
}));

vi.mock("@/components/layout/ListPageFilters", () => ({
  ListPageFilters: ({ searchActions }: { searchActions?: ReactNode }) => (
    <div>
      filters
      {searchActions}
    </div>
  ),
}));

vi.mock("@/components/leads/AddLeadDialog", () => ({
  AddLeadDialog: () => null,
}));

vi.mock("@/components/leads/LeadCard", () => ({
  LeadCard: () => null,
}));

vi.mock("@/components/jobs/CreateJobDialog", () => ({
  CreateJobDialog: () => null,
}));

vi.mock("@/components/jobs/JobCard", () => ({
  JobCard: () => null,
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
  ExportInvoicesModal: () => null,
}));

vi.mock("@/hooks/useLeads", () => ({
  useLeads: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useLeadCounts: () => ({
    data: { all: 0, new: 0, contacted: 0, qualified: 0, archive: 0 },
    refetch: vi.fn(),
  }),
  useArchivedLeads: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useDeleteLead: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/usePendingLeads", () => ({
  usePendingLeadsCount: () => ({ data: 0 }),
}));

vi.mock("@/hooks/useRejectedLeads", () => ({
  useRejectedLeads: () => ({ data: [] }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useJobs: () => ({ data: [], isLoading: false }),
  useJobRevenue: () => ({ data: 0 }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isManager: () => true,
    role: "owner",
  }),
}));

vi.mock("@/hooks/useEstimates", () => ({
  useEstimates: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/usePayments", () => ({
  usePayments: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ data: [], isLoading: false }),
}));

describe("List page sort menus", () => {
  it("shows an icon-triggered leads sort menu", () => {
    render(
      <MemoryRouter>
        <Leads />
      </MemoryRouter>,
    );

    const sortButton = screen.getByRole("button", { name: /sort leads/i });
    expect(sortButton).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows an icon-triggered jobs sort menu", () => {
    render(
      <MemoryRouter>
        <Jobs />
      </MemoryRouter>,
    );

    const sortButton = screen.getByRole("button", { name: /sort jobs/i });
    expect(sortButton).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows an icon-triggered payments sort menu", () => {
    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>,
    );

    const sortButton = screen.getByRole("button", { name: /sort all/i });
    expect(sortButton).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the payments sort button next to the search input", () => {
    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText("Search payments...");
    const searchRow = searchInput.closest("div")?.parentElement;
    const sortButton = screen.getByRole("button", { name: /sort all/i });

    expect(searchRow).not.toBeNull();
    expect(searchRow).toContainElement(sortButton);
  });

  it("shows an icon-triggered contacts sort menu", () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    const sortButton = screen.getByRole("button", { name: /sort contacts/i });
    expect(sortButton).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the contacts sort button next to the search input", () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText("Search contacts...");
    const searchRow = searchInput.closest("div")?.parentElement;
    const sortButton = screen.getByRole("button", { name: /sort contacts/i });

    expect(searchRow).not.toBeNull();
    expect(searchRow).toContainElement(sortButton);
  });
});
