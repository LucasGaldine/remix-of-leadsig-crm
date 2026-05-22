import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";

const mocks = vi.hoisted(() => ({
  scheduleJobMock: vi.fn(),
  deleteScheduleMutateAsyncMock: vi.fn(),
  updateScheduleMutateAsyncMock: vi.fn(),
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
    deleteSchedule: { mutateAsync: mocks.deleteScheduleMutateAsyncMock },
    updateSchedule: { mutateAsync: mocks.updateScheduleMutateAsyncMock },
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
      {
        user_id: "crew_2",
        full_name: "Jamie Crew",
        email: "jamie@example.com",
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
  Calendar: ({
    onSelect,
    onDayClick,
  }: {
    onSelect?: (date: Date) => void;
    onDayClick?: (date: Date) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        const pickedDate = new Date(2030, 0, 5);
        onSelect?.(pickedDate);
        onDayClick?.(pickedDate);
      }}
    >
      pick date
    </button>
  ),
}));

describe("ScheduleJobDialog without crew assignment", () => {
  it("prefills existing scheduled dates when opening in edit mode", () => {
    render(
      <ScheduleJobDialog
        open
        onOpenChange={vi.fn()}
        jobId="job_1"
        jobSchedules={[
          {
            id: "sched_existing_1",
            scheduled_date: "2030-01-05",
            scheduled_time_start: "09:00",
            scheduled_time_end: "11:00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /custom times/i }));
    expect(screen.getByText("JAN")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("uses a second step to assign crew and saves crew selection with the new schedule", async () => {
    mocks.scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "schedule_1" });
    mocks.deleteScheduleMutateAsyncMock.mockResolvedValue(undefined);
    mocks.updateScheduleMutateAsyncMock.mockResolvedValue(undefined);
    mocks.assignCrewAsyncMock.mockResolvedValue(undefined);
    mocks.supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
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

    expect(screen.queryByLabelText("Assign crew member")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "pick date" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Assign crew member")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assign crew member"), { target: { value: "alex" } });
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

  it("does not delete past schedules when editing current/future dates", async () => {
    mocks.scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "schedule_new" });
    mocks.deleteScheduleMutateAsyncMock.mockResolvedValue(undefined);
    mocks.updateScheduleMutateAsyncMock.mockResolvedValue(undefined);
    mocks.assignCrewAsyncMock.mockResolvedValue(undefined);
    mocks.supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
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

    render(
      <ScheduleJobDialog
        open
        onOpenChange={vi.fn()}
        jobId="job_1"
        jobSchedules={[
          {
            id: "past_sched",
            scheduled_date: "2020-01-01",
            scheduled_time_start: "09:00",
            scheduled_time_end: "10:00",
          },
          {
            id: "future_sched",
            scheduled_date: "2030-01-05",
            scheduled_time_start: "12:00",
            scheduled_time_end: "13:00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "pick date" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Schedule" }));

    await waitFor(() => {
      expect(mocks.deleteScheduleMutateAsyncMock).toHaveBeenCalled();
    });

    expect(mocks.deleteScheduleMutateAsyncMock).toHaveBeenCalledWith({
      id: "future_sched",
      lead_id: "job_1",
    });
    expect(mocks.deleteScheduleMutateAsyncMock).not.toHaveBeenCalledWith({
      id: "past_sched",
      lead_id: "job_1",
    });
  });
});
