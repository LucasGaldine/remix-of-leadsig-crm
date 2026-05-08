import { format } from "date-fns";
import { useState } from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MonthDayDateBadge } from "@/components/shared/MonthDayDateBadge";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/hooks/useTeamMembers";
import type { ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";

interface CreateJobCrewAssignmentStepProps {
  addedSchedules: ScheduleEntry[];
  isRecurringSchedule?: boolean;
  crewMembers: TeamMember[];
  assignedCrewByScheduleIndex: Record<number, string[]>;
  filteredCrewMembers: TeamMember[];
  crewSearchQuery: string;
  onCrewSearchQueryChange: (value: string) => void;
  selectedCrewIds?: string[];
  onAddSelectedCrew?: (crewId: string) => void;
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
  onRemoveSelectedCrew?: (crewId: string) => void;
}

export function CreateJobCrewAssignmentStep({
  addedSchedules,
  isRecurringSchedule = false,
  crewMembers,
  assignedCrewByScheduleIndex,
  filteredCrewMembers,
  crewSearchQuery,
  onCrewSearchQueryChange,
  selectedCrewIds = [],
  onAddSelectedCrew = () => {},
  activeCrewId,
  onActiveCrewIdChange,
  crewConflictByMember,
  isLoadingCrewConflicts,
  isCrewUnavailableForSelectedSchedules,
  isCrewAssignedToDay,
  isCrewConflictedOnDay,
  getCrewConflictDetail,
  onToggleSelectedCrewDay,
  onRemoveSelectedCrew = () => {},
}: CreateJobCrewAssignmentStepProps) {
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const effectiveSelectedCrewIds = selectedCrewIds.length > 0
    ? selectedCrewIds
    : (activeCrewId ? [activeCrewId] : []);
  const shouldShowSearchDropdown = isSearchDropdownOpen;

  const getCrewDisplayName = (crewId: string) => {
    const member = crewMembers.find((entry) => entry.user_id === crewId);
    return member?.full_name || member?.email || "Crew member";
  };

  const handleRemoveSelectedCrew = (crewId: string) => {
    onRemoveSelectedCrew(crewId);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {addedSchedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isRecurringSchedule
              ? "No recurring start date added yet. Go back and add a recurring start date."
              : "No schedule dates added yet. Go back and add at least one date."}
          </p>
        ) : crewMembers.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="crew-search" className="sr-only">Assign crew member</Label>
              <div className="relative">
                <div className="flex min-h-14 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                  {effectiveSelectedCrewIds.map((crewId) => {
                    const displayName = getCrewDisplayName(crewId);
                    return (
                      <div
                        key={crewId}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onActiveCrewIdChange(crewId)}
                          className="truncate"
                        >
                          {displayName}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${displayName}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleRemoveSelectedCrew(crewId)}
                          className="rounded-sm text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  <input
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
                    placeholder={effectiveSelectedCrewIds.length > 0
                      ? (isRecurringSchedule ? "Add to default selection" : "Add to selection")
                      : (isRecurringSchedule ? "Assign default crew member" : "Assign crew member")}
                    className="h-8 min-w-[10rem] flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none md:text-sm"
                  />
                </div>

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
                                onAddSelectedCrew(member.user_id);
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
                {isRecurringSchedule
                  ? "Checking crew availability for recurring default assignments..."
                  : "Checking crew availability for selected dates..."}
              </p>
            )}

            <div className={cn("pt-2 space-y-5", addedSchedules.length > 3 && "max-h-[16rem] overflow-y-auto pr-1")}>
              {addedSchedules.map((schedule, scheduleIndex) => {
                const [year, month, day] = schedule.date.split("-").map(Number);
                const localDate = new Date(year, month - 1, day);
                const isChecked = effectiveSelectedCrewIds.length > 0
                  ? effectiveSelectedCrewIds.every((crewId) => isCrewAssignedToDay(scheduleIndex, crewId))
                  : false;
                const isConflicted = effectiveSelectedCrewIds.length > 0
                  ? effectiveSelectedCrewIds.every((crewId) => isCrewConflictedOnDay(scheduleIndex, crewId))
                  : false;
                const conflictDetail = activeCrewId ? getCrewConflictDetail(scheduleIndex, activeCrewId) : null;
                const assignedCrewNames = (assignedCrewByScheduleIndex[scheduleIndex] || []).map(getCrewDisplayName);
                const assignedCrewLabel = assignedCrewNames.length > 0
                  ? assignedCrewNames.join(", ")
                  : (isRecurringSchedule ? "No default crew assigned" : "No crew assigned");
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
                    <div className="flex items-start gap-2">
                      {effectiveSelectedCrewIds.length > 0 && (
                        <Checkbox
                          id={`crew-day-${scheduleIndex}`}
                          checked={isChecked}
                          disabled={isConflicted}
                          onCheckedChange={() => onToggleSelectedCrewDay(scheduleIndex)}
                          className="mt-3"
                        />
                      )}
                      <MonthDayDateBadge date={localDate} size="sm" className={cn(isConflicted && "opacity-60")} />
                      <div className="pt-2">
                        {isRecurringSchedule && (
                          <span className="block text-xs text-muted-foreground">Default crew for recurring schedule</span>
                        )}
                        <span className="block text-sm text-muted-foreground">{assignedCrewLabel}</span>
                      </div>
                    </div>
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
