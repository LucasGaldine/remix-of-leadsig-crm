import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateEstimateDialog } from "@/components/leads/CreateEstimateDialog";

const {
  dismissMock,
  successMock,
  errorMock,
  loadingMock,
  invalidateQueriesMock,
  navigateMock,
  onOpenChangeMock,
  onSuccessMock,
  findOrCreateCustomerMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  dismissMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
  loadingMock: vi.fn(() => "loading-id"),
  invalidateQueriesMock: vi.fn(),
  navigateMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  onSuccessMock: vi.fn(),
  findOrCreateCustomerMock: vi.fn().mockResolvedValue({ id: "cust_1" }),
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: {
      id: "acct_1",
      default_profit_margin: 30,
      default_tax_rate: 7,
    },
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({ data: [] }),
}));

vi.mock("@/hooks/useScheduledJobs", () => ({
  useScheduledJobs: () => ({ data: [] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    void queryFn();
    return { data: new Set<string>() };
  },
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/lib/findOrCreateCustomer", () => ({
  findOrCreateCustomer: (...args: unknown[]) => findOrCreateCustomerMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("sonner", () => ({
  toast: {
    dismiss: dismissMock,
    error: errorMock,
    loading: loadingMock,
    success: successMock,
  },
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date("2026-04-10T10:00:00.000Z"))}>
      Pick date
    </button>
  ),
}));

describe("CreateEstimateDialog scheduling", () => {
  it("does not query or insert estimates when scheduling a visit", async () => {
    const estimatesSelectMock = vi.fn();
    const estimatesInsertMock = vi.fn();

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_schedules") {
        return {
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: "sched_1" }, error: null }),
            })),
          })),
        };
      }

      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { status: "qualified", is_estimate_visit: false }, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "estimates") {
        return {
          select: estimatesSelectMock,
          insert: estimatesInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <CreateEstimateDialog
        open
        onOpenChange={onOpenChangeMock}
        hasEstimate={false}
        lead={{
          id: "lead_1",
          name: "Alex Homeowner",
          phone: "5551112222",
          email: "alex@example.com",
          address: "123 Main St",
          city: "Austin",
          service_type: "Lawn Care",
          estimated_value: 1000,
        }}
        onSuccess={onSuccessMock}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Pick date" }));
    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));
    fireEvent.click(screen.getByRole("button", { name: /schedule 1 date/i }));

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith("Estimate visit scheduled!");
    });

    expect(estimatesSelectMock).not.toHaveBeenCalled();
    expect(estimatesInsertMock).not.toHaveBeenCalled();
  });
});
