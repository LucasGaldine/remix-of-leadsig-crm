import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/hooks/useTeamMembers";
import type { ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";

interface CreateJobCrewAssignmentStepProps {
  addedSchedules: ScheduleEntry[];
  crewMembers: TeamMember[];
  assignedCrewByScheduleIndex: Record<number, string[]>;
  filteredCrewMembers: TeamMember[];
  crewSearchQuery: string;
  onCrewSearchQueryChange: (value: string) => void;
  activeCrewId: string;
  onActiveCrewIdChange: (crewId: string) => void;
  crewConflictByMember: Record<string, number[]>;
  isLoadingCrewConflicts: boolean;
  isCrewUnavailableForSelectedSchedules: (crewId: string) => boolean;
  isCrewAssignedToDay: (scheduleIndex: number, crewId: string) => boolean;
  isCrewConflictedOnDay: (scheduleIndex: number, crewId: string) => boolean;
  getCrewConflictDetail: (
    scheduleIndex: number,
    crewId: string,
  ) => {
    jobTitle: string;
    scheduledDate: string;
    scheduledTimeStart: string | null;
    scheduledTimeEnd: string | null;
  } | null;
  onToggleSelectedCrewDay: (scheduleIndex: number) => void;
}

export function CreateJobCrewAssignmentStep({
  addedSchedules,
  crewMembers,
  assignedCrewByScheduleIndex,
  filteredCrewMembers,
  crewSearchQuery,
  onCrewSearchQueryChange,
  activeCrewId,
  onActiveCrewIdChange,
  crewConflictByMember,
  isLoadingCrewConflicts,
  isCrewUnavailableForSelectedSchedules,
  isCrewAssignedToDay,
  isCrewConflictedOnDay,
  getCrewConflictDetail,
  onToggleSelectedCrewDay,
}: CreateJobCrewAssignmentStepProps) {
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const shouldShowSearchDropdown = isSearchDropdownOpen;

  const getCrewDisplayName = (crewId: string) => {
    const member = crewMembers.find((entry) => entry.user_id === crewId);
    return member?.full_name || member?.email || "Crew member";
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {addedSchedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No schedule dates added yet. Go back and add at least one date.
          </p>
        ) : crewMembers.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="crew-search">Find Crew Member</Label>
              <div className="relative">
                <Input
                  id="crew-search"
                  value={crewSearchQuery}
                  onChange={(event) => {
                    onCrewSearchQueryChange(event.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onClick={() => setIsSearchDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsSearchDropdownOpen(false), 100);
                  }}
                  placeholder="Search by name or email"
                />

                {shouldShowSearchDropdown && (
                  <div className="absolute left-0 right-0 z-20 mt-2 rounded-md border border-border bg-background shadow-md max-h-[110px] overflow-y-auto">
                    {filteredCrewMembers.length > 0 ? (
                      filteredCrewMembers.map((member) => {
                        const memberLabel = member.full_name || member.email || "Unnamed crew member";
                        const selected = member.user_id === activeCrewId;
                        const conflictCount = (crewConflictByMember[member.user_id] || []).length;
                        const unavailableForCurrentSchedules = isCrewUnavailableForSelectedSchedules(member.user_id);
                        return (
                          <button
                            key={member.user_id}
                            type="button"
                            onClick={() => {
                              if (!unavailableForCurrentSchedules) {
                                onActiveCrewIdChange(member.user_id);
                                onCrewSearchQueryChange("");
                                setIsSearchDropdownOpen(false);
                              }
                            }}
                            disabled={unavailableForCurrentSchedules}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              selected ? "bg-muted font-medium" : "hover:bg-muted/50"
                            } ${
                              unavailableForCurrentSchedules ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{memberLabel}</span>
                              {conflictCount > 0 && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {unavailableForCurrentSchedules
                                    ? "Unavailable"
                                    : `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground px-3 py-3">
                        No crew members found.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isLoadingCrewConflicts && (
              <p className="text-xs text-muted-foreground">
                Checking crew availability for selected dates...
              </p>
            )}

            <div className="space-y-5">
              {addedSchedules.map((schedule, scheduleIndex) => {
                const [year, month, day] = schedule.date.split("-").map(Number);
                const localDate = new Date(year, month - 1, day);
                const isChecked = activeCrewId ? isCrewAssignedToDay(scheduleIndex, activeCrewId) : false;
                const isConflicted = activeCrewId ? isCrewConflictedOnDay(scheduleIndex, activeCrewId) : false;
                const conflictDetail = activeCrewId ? getCrewConflictDetail(scheduleIndex, activeCrewId) : null;
                const assignedCrewNames = (assignedCrewByScheduleIndex[scheduleIndex] || []).map(getCrewDisplayName);
                const assignedCrewLabel = assignedCrewNames.length > 0
                  ? assignedCrewNames.join(", ")
                  : "No crew assigned";
                const badgeDate = conflictDetail
                  ? (() => {
                      const [badgeYear, badgeMonth, badgeDay] = conflictDetail.scheduledDate.split("-").map(Number);
                      return format(new Date(badgeYear, badgeMonth - 1, badgeDay), "MMM d, yyyy");
                    })()
                  : "";
                const badgeTime = conflictDetail
                  ? `${conflictDetail.scheduledTimeStart || "--:--"} - ${conflictDetail.scheduledTimeEnd || "--:--"}`
                  : "";

                return (
                  <div key={`${schedule.date}-${scheduleIndex}`} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {activeCrewId && (
                        <Checkbox
                          id={`crew-day-${scheduleIndex}`}
                          checked={isChecked}
                          disabled={isConflicted}
                          onCheckedChange={() => onToggleSelectedCrewDay(scheduleIndex)}
                        />
                      )}
                      <p
                        className={cn(
                          "text-sm font-medium leading-none",
                          isConflicted && "text-muted-foreground line-through",
                        )}
                      >
                        {format(localDate, "EEEE, MMM d, yyyy")}
                        {(schedule.timeStart || schedule.timeEnd) && (
                          <span className={cn("text-muted-foreground", isConflicted && "line-through")}>
                            {" "}({schedule.timeStart || "--:--"} - {schedule.timeEnd || "--:--"})
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="block text-xs text-muted-foreground">{assignedCrewLabel}</span>
                    {activeCrewId && isConflicted && (
                      <div className="flex items-center gap-2">
                        <span className="block text-xs text-muted-foreground">
                          Unavailable: already assigned at this time.
                        </span>
                        {conflictDetail && (
                          <Badge variant="outline" size="sm" className="text-[10px] text-muted-foreground">
                            {conflictDetail.jobTitle} · {badgeDate} · {badgeTime}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No crew members available. You can assign later.
          </p>
        )}
      </div>
    </div>
  );
}
