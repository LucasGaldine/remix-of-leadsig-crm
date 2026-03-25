import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
    isManager: true,
  }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useCreateJob: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useRecurringJobs", () => ({
  useCreateRecurringJob: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCreateCustomer: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useJobSchedules", () => ({
  useAddJobSchedule: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [],
  }),
}));

vi.mock("@/components/clients/ClientSelector", () => ({
  ClientSelector: () => <div>Client Selector</div>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: (props: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      checked={!!props.checked}
      onChange={(event) => props.onCheckedChange?.(event.target.checked)}
    />
  ),
}));

describe("CreateJobDialog layout", () => {
  it("matches the create-lead style flow with csv import and no scheduling section", () => {
    render(<CreateJobDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: /import from csv/i })).toBeInTheDocument();
    expect(screen.getByText(/or add manually/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Job Details$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Scheduling$/)).not.toBeInTheDocument();
  });
});
