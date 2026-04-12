import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";

const mocks = vi.hoisted(() => ({
  scheduleJobMock: vi.fn(),
  assignCrewAsyncMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useScheduleJob", () => ({
  useScheduleJob: () => ({
    scheduleJob: mocks.scheduleJobMock,
    isScheduling: false,
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [
      {
        user_id: "crew_1",
        full_name: "Alex Crew",
        email: "alex@example.com",
        role: "crew_member",
      },
    ],
  }),
}));

vi.mock("@/hooks/useJobAssignments", () => ({
  useJobAssignments: () => ({
    assignCrewAsync: mocks.assignCrewAsyncMock,
    isAssigning: false,
  }),
}));

vi.mock("@/hooks/useScheduledJobs", () => ({
  useScheduledJobs: () => ({
    data: [],
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: new Set<string>() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.supabaseFromMock,
  },
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2030-01-05"))}>
      pick date
    </button>
  ),
}));

describe("ScheduleJobDialog without crew assignment", () => {
  it("uses a second step to assign crew and saves crew selection with the new schedule", async () => {
    mocks.scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "schedule_1" });
    mocks.assignCrewAsyncMock.mockResolvedValue(undefined);
    mocks.supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<ScheduleJobDialog open onOpenChange={vi.fn()} jobId="job_1" />);

    expect(screen.queryByLabelText("Find Crew Member")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "pick date" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Date" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Find Crew Member")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "alex" } });
    fireEvent.click(screen.getByRole("button", { name: /Alex Crew/i }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Schedule" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule" }));

    await waitFor(() => {
      expect(mocks.scheduleJobMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.assignCrewAsyncMock).toHaveBeenCalledWith({
        assigneeId: "crew_1",
        scheduleId: "schedule_1",
      });
    });

    expect(mocks.scheduleJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "job_1",
        scheduledDate: expect.stringMatching(/^2030-01-0[45]$/),
      }),
    );
  });
});
