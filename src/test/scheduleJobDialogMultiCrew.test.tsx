import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";

const mocks = vi.hoisted(() => ({
  scheduleJobMock: vi.fn(),
  insertAssignmentsMock: vi.fn(),
  rpcMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

function buildQueryResult<T>(result: T) {
  return {
    eq() {
      return this;
    },
    in() {
      return this;
    },
    then(resolve: (value: T) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
}

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

vi.mock("@/hooks/useScheduledJobs", () => ({
  useScheduledJobs: () => ({
    data: [],
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [
      { user_id: "crew_1", full_name: "Alex Crew", role: "crew_member" },
      { user_id: "crew_2", full_name: "Sam Lead", role: "crew_lead" },
    ],
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "job_assignments") {
        return {
          select: () => buildQueryResult({ data: [], error: null }),
          insert: mocks.insertAssignmentsMock,
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { full_name: "Crew Member" }, error: null }),
            }),
          }),
        };
      }

      return {
        select: () => buildQueryResult({ data: [], error: null }),
      };
    },
    rpc: mocks.rpcMock,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: new Set<string>() }),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2030-01-05"))}>
      pick date
    </button>
  ),
}));

describe("ScheduleJobDialog multi-crew assignment", () => {
  it("assigns multiple selected crew members from one modal submission", async () => {
    mocks.invalidateQueriesMock.mockReset();
    mocks.scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "schedule_1" });
    mocks.insertAssignmentsMock.mockResolvedValue({ error: null });
    mocks.rpcMock.mockResolvedValue({ data: false });

    render(<ScheduleJobDialog open onOpenChange={vi.fn()} jobId="job_1" />);

    fireEvent.click(screen.getByRole("button", { name: "pick date" }));
    fireEvent.click(screen.getByLabelText("Alex Crew"));
    fireEvent.click(screen.getByLabelText("Sam Lead"));
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule" }));

    await waitFor(() => {
      expect(mocks.insertAssignmentsMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.insertAssignmentsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "crew_1", job_schedule_id: "schedule_1", lead_id: "job_1" }),
        expect.objectContaining({ user_id: "crew_2", job_schedule_id: "schedule_1", lead_id: "job_1" }),
      ]),
    );

    await waitFor(() => {
      expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["job-assignments", "job_1"] });
    });
  });
});
