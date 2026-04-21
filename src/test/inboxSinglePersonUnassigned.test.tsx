import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Inbox from "@/pages/Inbox";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: () => <header>Inbox</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => null,
}));

vi.mock("@/components/layout/MainPageQuickActions", () => ({
  MainPageQuickActions: () => null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isManager: () => true,
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [{ user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" }],
  }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useLeads", () => ({
  useLeads: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useJobs: () => ({
    data: [
      {
        id: "job_1",
        name: "Bob Miller",
        created_at: "2026-04-20T10:00:00.000Z",
        display_status: "scheduled",
        status: "scheduled",
        service_type: null,
        has_unassigned_schedule: true,
        has_invoice: false,
        is_estimate_visit: false,
        customer: { name: "Bob Miller" },
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
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

describe("Inbox single-person status handling", () => {
  it("does not show unassigned for jobs in single-person companies", () => {
    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });
});
