import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useScheduleJob", () => ({
  useScheduleJob: () => ({
    scheduleJob: vi.fn(),
    isScheduling: false,
  }),
}));

vi.mock("@/hooks/useScheduledJobs", () => ({
  useScheduledJobs: () => ({
    data: [],
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [],
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: new Set<string>() }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}));

describe("ScheduleJobDialog recurring shortcut", () => {
  it("shows no date selected state before a date is chosen", () => {
    render(
      <ScheduleJobDialog
        open
        onOpenChange={vi.fn()}
        jobId="job_1"
      />
    );

    expect(screen.getByText("No date selected")).toBeInTheDocument();
  });

  it("offers a recurring shortcut and opens recurring flow from add date dialog", () => {
    const onOpenChange = vi.fn();
    const onMakeRecurring = vi.fn();

    render(
      <ScheduleJobDialog
        open
        onOpenChange={onOpenChange}
        jobId="job_1"
        hasSchedules
        onMakeRecurring={onMakeRecurring}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Make Recurring Instead" }));

    expect(onMakeRecurring).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("places recurring near time controls and keeps spacing between footer actions", () => {
    render(
      <ScheduleJobDialog
        open
        onOpenChange={vi.fn()}
        jobId="job_1"
        hasSchedules
        onMakeRecurring={vi.fn()}
      />
    );

    const recurringButton = screen.getByRole("button", { name: "Make Recurring Instead" });
    const recurringContainer = recurringButton.parentElement;
    expect(recurringContainer?.className).toContain("justify-start");

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const footerContainer = cancelButton.parentElement;
    expect(footerContainer?.className).toContain("gap-3");
  });
});
