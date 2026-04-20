import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

const createJobMutateAsync = vi.fn().mockResolvedValue({ id: "job_1" });
const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
    isManager: true,
  }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useCreateJob: () => ({
    mutateAsync: createJobMutateAsync,
  }),
  useDeleteJob: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useRecurringJobs", () => ({
  useCreateRecurringJob: () => ({
    mutateAsync: vi.fn(),
  }),
  useConvertToRecurring: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
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
  useUpdateJobSchedule: () => ({
    mutateAsync: vi.fn(),
  }),
  useDeleteJobSchedule: () => ({
    mutateAsync: vi.fn(),
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/components/clients/ClientSelector", () => ({
  ClientSelector: (props: { onSelect: (customer: any) => void; onModeChange: (mode: "existing" | "new") => void }) => (
    <div>
      Client Selector
      <button
        type="button"
        onClick={() => {
          props.onModeChange("existing");
          props.onSelect({
            id: "customer_1",
            name: "Test Client",
            phone: null,
            email: null,
            address: null,
          });
        }}
      >
        Mock Select Client
      </button>
    </div>
  ),
}));

vi.mock("@/components/jobs/JobCSVImportModal", () => ({
  JobCSVImportModal: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock("@/components/payments/EditEstimateModal", () => ({
  EditEstimateModal: () => null,
}));

vi.mock("@/components/voice/VoiceIntakePanel", () => ({
  VoiceIntakePanel: () => <div>Mock Voice Intake Panel</div>,
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

vi.mock("@/components/scheduling/ScheduleDateBuilder", () => ({
  ScheduleDateBuilder: (props: { recurringControls?: any }) => (
    <div>
      <p>Add Schedule Dates</p>
      {props.recurringControls}
      <button type="button">Add Schedule Date</button>
    </div>
  ),
}));

describe("CreateJobDialog layout", () => {
  it("shows Skip & Create on step 1 and enables it only after selecting a client", () => {
    render(<CreateJobDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: /skip & create/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    expect(screen.getByRole("button", { name: /skip & create/i })).toBeEnabled();
  });

  it("uses a multi-step manual flow starting with client selection", () => {
    render(<CreateJobDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: /import from csv/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled();
  });

  it("keeps Skip & Create and moves through steps with continue", () => {
    render(<CreateJobDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip & create/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /skip this step/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/step 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add schedule date/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^recurring$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/step 4 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^assign crew$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/step 5 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voice estimate intake/i })).toBeInTheDocument();
  });

  it("toggles to voice estimate intake on step 5", () => {
    render(<CreateJobDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    fireEvent.click(screen.getByRole("button", { name: /voice estimate intake/i }));
    expect(screen.getByText(/mock voice intake panel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to manual form/i })).toBeInTheDocument();
  });

  it("can create immediately from job info via Skip & Create", () => {
    const onOpenChangeMock = vi.fn();
    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);

    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip & create/i }));

    return waitFor(() => {
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });
  });
});
