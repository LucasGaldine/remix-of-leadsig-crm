import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateJobCrewAssignmentStep } from "@/components/jobs/CreateJobCrewAssignmentStep";
import type { TeamMember } from "@/hooks/useTeamMembers";
import type { ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";

const crewMembers: TeamMember[] = [
  {
    user_id: "crew_1",
    full_name: "Alex Johnson",
    email: "alex@example.com",
    role: "crew_member",
    description: null,
    invited_at: null,
    is_mock_profile: false,
    mock_profile_id: null,
    phone: null,
  },
  {
    user_id: "crew_2",
    full_name: "Kevin Mock",
    email: "kevin@example.com",
    role: "crew_member",
    description: null,
    invited_at: null,
    is_mock_profile: false,
    mock_profile_id: null,
    phone: null,
  },
];

const schedules: ScheduleEntry[] = [
  {
    date: "2026-04-20",
    timeStart: "09:00",
    timeEnd: "11:00",
  },
];

describe("CreateJobCrewAssignmentStep", () => {
  it("shows guidance when there are no schedules", () => {
    render(
      <CreateJobCrewAssignmentStep
        addedSchedules={[]}
        crewMembers={crewMembers}
        assignedCrewByScheduleIndex={{}}
        filteredCrewMembers={crewMembers}
        crewSearchQuery=""
        onCrewSearchQueryChange={vi.fn()}
        activeCrewId=""
        onActiveCrewIdChange={vi.fn()}
        crewConflictByMember={{}}
        isLoadingCrewConflicts={false}
        isCrewUnavailableForSelectedSchedules={vi.fn().mockReturnValue(false)}
        isCrewAssignedToDay={vi.fn().mockReturnValue(false)}
        isCrewConflictedOnDay={vi.fn().mockReturnValue(false)}
        getCrewConflictDetail={vi.fn().mockReturnValue(null)}
        onToggleSelectedCrewDay={vi.fn()}
      />,
    );

    expect(screen.getByText(/No schedule dates added yet/i)).toBeInTheDocument();
  });

  it("lets users choose a crew member and assign scheduled days", () => {
    const onActiveCrewIdChange = vi.fn();
    const onToggleSelectedCrewDay = vi.fn();

    render(
      <CreateJobCrewAssignmentStep
        addedSchedules={schedules}
        crewMembers={crewMembers}
        assignedCrewByScheduleIndex={{}}
        filteredCrewMembers={[crewMembers[0]]}
        crewSearchQuery="alex"
        onCrewSearchQueryChange={vi.fn()}
        activeCrewId="crew_1"
        onActiveCrewIdChange={onActiveCrewIdChange}
        crewConflictByMember={{}}
        isLoadingCrewConflicts={false}
        isCrewUnavailableForSelectedSchedules={vi.fn().mockReturnValue(false)}
        isCrewAssignedToDay={vi.fn().mockReturnValue(false)}
        isCrewConflictedOnDay={vi.fn().mockReturnValue(false)}
        getCrewConflictDetail={vi.fn().mockReturnValue(null)}
        onToggleSelectedCrewDay={onToggleSelectedCrewDay}
      />,
    );

    fireEvent.focus(screen.getByLabelText("Find Crew Member"));
    fireEvent.click(screen.getAllByRole("button", { name: /Alex Johnson/i })[0]);
    expect(onActiveCrewIdChange).toHaveBeenCalledWith("crew_1");

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggleSelectedCrewDay).toHaveBeenCalledWith(0);
  });

  it("shows all crew results on focus and filters results as search changes", () => {
    const onSearchChange = vi.fn();

    const { rerender } = render(
      <CreateJobCrewAssignmentStep
        addedSchedules={schedules}
        crewMembers={crewMembers}
        assignedCrewByScheduleIndex={{}}
        filteredCrewMembers={crewMembers}
        crewSearchQuery=""
        onCrewSearchQueryChange={onSearchChange}
        activeCrewId=""
        onActiveCrewIdChange={vi.fn()}
        crewConflictByMember={{}}
        isLoadingCrewConflicts={false}
        isCrewUnavailableForSelectedSchedules={vi.fn().mockReturnValue(false)}
        isCrewAssignedToDay={vi.fn().mockReturnValue(false)}
        isCrewConflictedOnDay={vi.fn().mockReturnValue(false)}
        getCrewConflictDetail={vi.fn().mockReturnValue(null)}
        onToggleSelectedCrewDay={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Alex Johnson/i })).not.toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("Find Crew Member"));
    expect(screen.getByRole("button", { name: /Alex Johnson/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kevin Mock/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "kev" } });
    expect(onSearchChange).toHaveBeenCalledWith("kev");

    rerender(
      <CreateJobCrewAssignmentStep
        addedSchedules={schedules}
        crewMembers={crewMembers}
        assignedCrewByScheduleIndex={{ 0: ["crew_2"] }}
        filteredCrewMembers={[crewMembers[1]]}
        crewSearchQuery="kev"
        onCrewSearchQueryChange={onSearchChange}
        activeCrewId=""
        onActiveCrewIdChange={vi.fn()}
        crewConflictByMember={{}}
        isLoadingCrewConflicts={false}
        isCrewUnavailableForSelectedSchedules={vi.fn().mockReturnValue(false)}
        isCrewAssignedToDay={vi.fn().mockReturnValue(false)}
        isCrewConflictedOnDay={vi.fn().mockReturnValue(false)}
        getCrewConflictDetail={vi.fn().mockReturnValue(null)}
        onToggleSelectedCrewDay={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Kevin Mock/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alex Johnson/i })).not.toBeInTheDocument();
  });

  it("mutes and annotates conflicted dates with the assigned job/time badge", () => {
    render(
      <CreateJobCrewAssignmentStep
        addedSchedules={schedules}
        crewMembers={crewMembers}
        assignedCrewByScheduleIndex={{}}
        filteredCrewMembers={crewMembers}
        crewSearchQuery=""
        onCrewSearchQueryChange={vi.fn()}
        activeCrewId="crew_1"
        onActiveCrewIdChange={vi.fn()}
        crewConflictByMember={{ crew_1: [0] }}
        isLoadingCrewConflicts={false}
        isCrewUnavailableForSelectedSchedules={vi.fn().mockReturnValue(false)}
        isCrewAssignedToDay={vi.fn().mockReturnValue(false)}
        isCrewConflictedOnDay={vi.fn().mockReturnValue(true)}
        getCrewConflictDetail={vi.fn().mockReturnValue({
          jobTitle: "Mulch Install",
          scheduledDate: "2026-04-20",
          scheduledTimeStart: "09:00",
          scheduledTimeEnd: "11:00",
        })}
        onToggleSelectedCrewDay={vi.fn()}
      />,
    );

    expect(screen.getByText(/Unavailable: already assigned at this time/i)).toBeInTheDocument();
    expect(screen.getByText(/Mulch Install · Apr 20, 2026 · 09:00 - 11:00/i)).toBeInTheDocument();
    expect(screen.getByText(/Monday, Apr 20, 2026/i)).toHaveClass("line-through");
  });
});
