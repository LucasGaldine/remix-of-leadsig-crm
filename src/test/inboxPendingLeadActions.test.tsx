import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Inbox from "@/pages/Inbox";

const approveMutateAsync = vi.fn().mockResolvedValue({});
const rejectMutateAsync = vi.fn().mockResolvedValue({});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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
    data: [{ user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" }],
  }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useLeads", () => ({
  useLeads: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/usePendingLeads", () => ({
  usePendingLeads: () => ({
    data: [
      {
        id: "pending_1",
        name: "Pending Prospect",
        created_at: "2026-05-10T10:00:00.000Z",
        submitted_at: "2026-05-11T10:00:00.000Z",
        service_type: "Roof repair",
        source: "website",
      },
    ],
    isLoading: false,
  }),
  useApproveLead: () => ({ mutateAsync: approveMutateAsync, isPending: false }),
  useRejectLead: () => ({ mutateAsync: rejectMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useJobs: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
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

describe("Inbox pending lead actions", () => {
  it("shows approve/deny actions and triggers mutations", async () => {
    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /leads 1/i }));

    const approveButton = screen.getByRole("button", { name: /approve pending prospect/i });
    const denyButton = screen.getByRole("button", { name: /deny pending prospect/i });

    fireEvent.click(approveButton);
    fireEvent.click(denyButton);

    await waitFor(() => {
      expect(approveMutateAsync).toHaveBeenCalledWith("pending_1");
      expect(rejectMutateAsync).toHaveBeenCalledWith({ id: "pending_1", reason: "other" });
    });
  });
});
