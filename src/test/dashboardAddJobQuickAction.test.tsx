import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Index from "@/pages/Index";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00.000Z" },
    isCrewMember: () => false,
    profile: { full_name: "Owner Person" },
  }),
}));

vi.mock("@/hooks/useDashboardPreferences", () => ({
  useDashboardPreferences: () => ({ sections: [] }),
}));

vi.mock("@/hooks/useDashboardLeads", () => ({
  useQualifiedLeads: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  usePendingApprovalEstimates: () => ({ data: [], isLoading: false }),
  useActiveJobs: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({ data: [] }),
}));

vi.mock("@/hooks/useCustomersNeedingAttention", () => ({
  useCustomersNeedingAttention: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: () => <header>Dashboard</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/dashboard/DashboardStatCards", () => ({
  DashboardStatCards: () => <section>Stats</section>,
}));

vi.mock("@/components/dashboard/DashboardVisuals", () => ({
  DashboardVisuals: () => <section>Visuals</section>,
}));

vi.mock("@/components/auth/EmailVerificationBanner", () => ({
  EmailVerificationBanner: () => null,
}));

vi.mock("@/components/leads/AddLeadDialog", () => ({
  AddLeadDialog: () => null,
}));

vi.mock("@/components/jobs/AddJobDialog", () => ({
  AddJobDialog: ({ open }: { open: boolean }) => (open ? <div>legacy-add-job-dialog</div> : null),
}));

vi.mock("@/components/jobs/CreateJobDialog", () => ({
  CreateJobDialog: ({ open }: { open: boolean }) => (open ? <div>new-create-job-dialog</div> : null),
}));

describe("Dashboard Add Job quick action", () => {
  it("opens the latest create-job dialog flow", () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /add job/i }));

    expect(screen.getByText("new-create-job-dialog")).toBeInTheDocument();
  });

  it("opens both lead and job actions from the dashboard floating menu", () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    expect(screen.getByRole("button", { name: /add lead/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add job/i })).toBeInTheDocument();
  });
});
