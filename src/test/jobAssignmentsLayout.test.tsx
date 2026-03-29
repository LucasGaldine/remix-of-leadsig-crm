import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobAssignments } from "@/components/jobs/JobAssignments";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: { id: "acct_1" },
    isManager: () => true,
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [],
  }),
}));

vi.mock("@/hooks/useJobSchedules", () => ({
  useJobSchedules: () => ({
    data: [
      {
        id: "sched_1",
        scheduled_date: "2026-03-30",
        scheduled_time_start: null,
        scheduled_time_end: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useJobAssignments", () => ({
  useJobAssignments: () => ({
    assignments: [],
    isLoading: false,
    assignCrew: vi.fn(),
    unassignCrew: vi.fn(),
    isAssigning: false,
    isUnassigning: false,
  }),
}));

describe("JobAssignments embedded layout", () => {
  it("uses schedule-like date rows for embedded assigned crew", () => {
    render(<JobAssignments leadId="job_1" embedded />);

    const dateRow = screen
      .getByText("0 assigned")
      .closest("div[class*='bg-secondary/50']");

    expect(screen.getByText("Assigned Crew")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Crew" })).toBeInTheDocument();
    expect(screen.getByText("Monday, March 30, 2026")).toBeInTheDocument();
    expect(dateRow).toBeTruthy();
    expect(screen.getByText("No crew assigned to this schedule")).toBeInTheDocument();
  });
});
