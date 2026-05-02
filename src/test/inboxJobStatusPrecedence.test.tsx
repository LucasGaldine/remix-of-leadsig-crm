import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Inbox from "@/pages/Inbox";

const mockedJobs = vi.hoisted(() => ({
  data: [
    {
      id: "job_1",
      name: "Bob Miller",
      created_at: "2026-04-20T10:00:00.000Z",
      display_status: "unscheduled",
      status: "job",
      service_type: null,
      has_unassigned_schedule: true,
      has_invoice: false,
      is_estimate_visit: false,
      customer: { name: "Bob Miller" },
    },
  ] as any[],
}));

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
    data: [
      { user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" },
      { user_id: "crew_1", full_name: "Crew One", email: "crew@example.com" },
    ],
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
    data: mockedJobs.data,
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

describe("Inbox job status precedence", () => {
  it("shows unscheduled before unassigned", () => {
    mockedJobs.data = [
      {
        id: "job_1",
        name: "Bob Miller",
        created_at: "2026-04-20T10:00:00.000Z",
        display_status: "unscheduled",
        status: "job",
        service_type: null,
        has_unassigned_schedule: true,
        has_invoice: false,
        is_estimate_visit: false,
        customer: { name: "Bob Miller" },
      },
    ];

    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();
  });

  it("shows completed when underlying status is completed even if display status is unscheduled", () => {
    mockedJobs.data = [
      {
        id: "job_1",
        name: "Bob Miller",
        created_at: "2026-04-20T10:00:00.000Z",
        display_status: "unscheduled",
        status: "completed",
        service_type: null,
        has_unassigned_schedule: true,
        has_invoice: true,
        is_estimate_visit: false,
        customer: { name: "Bob Miller" },
      },
    ];

    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Unscheduled")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
