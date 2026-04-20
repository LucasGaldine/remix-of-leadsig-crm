import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useJobAssignments } from "@/hooks/useJobAssignments";
import { ScheduleDateBuilder, type ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";
import { CreateJobCrewAssignmentStep } from "@/components/jobs/CreateJobCrewAssignmentStep";
import { supabase } from "@/integrations/supabase/client";
import { buildMockCrewAssigneeId, parseCrewAssigneeId } from "@/lib/crewIdentifiers";
import { isSinglePersonCompany as isSinglePersonCompanyByMembers } from "@/lib/teamMembers";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ScheduleJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName?: string;
  hasSchedules?: boolean;
  onMakeRecurring?: () => void;
  jobSchedules?: Array<{
    id: string;
    scheduled_date: string;
    scheduled_time_start?: string | null;
    scheduled_time_end?: string | null;
  }>;
}

type CrewConflictDetail = {
  jobTitle: string;
  scheduledDate: string;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
};

export function ScheduleJobDialog({ 
  open, 
  onOpenChange, 
  jobId, 
  jobName,
  hasSchedules = false,
  onMakeRecurring,
  jobSchedules,
}: ScheduleJobDialogProps) {
  const { scheduleJob, isScheduling, deleteSchedule, updateSchedule } = useScheduleJob();
  const { currentAccount, user } = useAuth();
  const { data: crewMembers = [] } = useTeamMembers();
  const { assignCrewAsync, isAssigning } = useJobAssignments(jobId);
  
  const [builderSchedules, setBuilderSchedules] = useState<ScheduleEntry[]>([]);
  const [step, setStep] = useState<"schedule" | "crew-assignment">("schedule");
  const [crewByScheduleIndex, setCrewByScheduleIndex] = useState<Record<number, string[]>>({});
  const [crewConflictByMember, setCrewConflictByMember] = useState<Record<string, number[]>>({});
  const [crewConflictDetailsByMember, setCrewConflictDetailsByMember] = useState<
    Record<string, Record<number, CrewConflictDetail>>
  >({});
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [activeCrewId, setActiveCrewId] = useState<string>("");
  const [isLoadingCrewConflicts, setIsLoadingCrewConflicts] = useState(false);
  const isSinglePersonCompany = isSinglePersonCompanyByMembers(crewMembers);
  const todayDateKey = format(new Date(), "yyyy-MM-dd");
  const resolvedJobSchedules = useMemo(() => jobSchedules ?? [], [jobSchedules]);
  const initialScheduleEntries = useMemo<ScheduleEntry[]>(
    () =>
      resolvedJobSchedules
        .map((schedule) => ({
          date: schedule.scheduled_date,
          timeStart: schedule.scheduled_time_start || "",
          timeEnd: schedule.scheduled_time_end || "",
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((schedule, index, array) => index === array.findIndex((entry) => entry.date === schedule.date)),
    [resolvedJobSchedules],
  );
  const editableInitialScheduleEntries = useMemo(
    () => initialScheduleEntries.filter((schedule) => schedule.date >= todayDateKey),
    [initialScheduleEntries, todayDateKey],
  );
  const editableInitialScheduleIdByDate = useMemo(
    () =>
      resolvedJobSchedules.reduce<Record<string, string>>((acc, schedule) => {
        if (schedule.scheduled_date < todayDateKey) return acc;
        if (!acc[schedule.scheduled_date]) {
          acc[schedule.scheduled_date] = schedule.id;
        }
        return acc;
      }, {}),
    [resolvedJobSchedules, todayDateKey],
  );
  const isEditingSchedules = initialScheduleEntries.length > 0;
  const crewStepSchedules = builderSchedules;
  const crewMemberIdsKey = crewMembers
    .map((member) => member.user_id)
    .sort()
    .join("|");
  const scheduleConflictKey = crewStepSchedules
    .map((schedule) => `${schedule.date}:${schedule.timeStart || ""}:${schedule.timeEnd || ""}`)
    .join("|");

  const filteredCrewMembers = useMemo(() => {
    if (!crewSearchQuery.trim()) return crewMembers;
    const query = crewSearchQuery.toLowerCase();
    return crewMembers.filter((member) =>
      (member.full_name || "").toLowerCase().includes(query) ||
      (member.email || "").toLowerCase().includes(query),
    );
  }, [crewMembers, crewSearchQuery]);
  const validCrewIdSet = useMemo(() => new Set(crewMembers.map((member) => member.user_id)), [crewMembers]);

  useEffect(() => {
    if (!open) return;
    setBuilderSchedules(editableInitialScheduleEntries);
    setStep("schedule");
    setCrewByScheduleIndex({});
    setCrewConflictByMember({});
    setCrewConflictDetailsByMember({});
    setCrewSearchQuery("");
    setSelectedCrewIds([]);
    setActiveCrewId("");
  }, [open, editableInitialScheduleEntries]);

  useEffect(() => {
    if (!isSinglePersonCompany || step !== "crew-assignment") return;
    setStep("schedule");
  }, [isSinglePersonCompany, step]);

  useEffect(() => {
    if (!open || step !== "crew-assignment") return;

    if (!currentAccount?.id || crewStepSchedules.length === 0 || crewMembers.length === 0) {
      setCrewConflictByMember({});
      setCrewConflictDetailsByMember({});
      setIsLoadingCrewConflicts(false);
      return;
    }

    let isCancelled = false;

    const loadCrewConflicts = async () => {
      setIsLoadingCrewConflicts(true);

      const parsedCrew = crewMembers.map((member) => parseCrewAssigneeId(member.user_id));
      const realCrewIds = parsedCrew
        .filter((member) => member.type === "user" && member.userId)
        .map((member) => member.userId as string)
        .filter((id) => UUID_REGEX.test(id));
      const mockCrewIds = parsedCrew
        .filter((member) => member.type === "mock" && member.mockProfileId)
        .map((member) => member.mockProfileId as string)
        .filter((id) => UUID_REGEX.test(id));

      const assignmentRows: any[] = [];

      if (realCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select("user_id, mock_crew_profile_id, job_schedules!inner(lead_id, scheduled_date, scheduled_time_start, scheduled_time_end)")
          .in("user_id", realCrewIds)
          .eq("account_id", currentAccount.id);

        if (isCancelled) return;
        if (error) {
          setCrewConflictByMember({});
          setCrewConflictDetailsByMember({});
          setIsLoadingCrewConflicts(false);
          return;
        }
        assignmentRows.push(...(data || []));
      }

      if (mockCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select("user_id, mock_crew_profile_id, job_schedules!inner(lead_id, scheduled_date, scheduled_time_start, scheduled_time_end)")
          .in("mock_crew_profile_id", mockCrewIds)
          .eq("account_id", currentAccount.id);

        if (isCancelled) return;
        if (error) {
          setCrewConflictByMember({});
          setCrewConflictDetailsByMember({});
          setIsLoadingCrewConflicts(false);
          return;
        }
        assignmentRows.push(...(data || []));
      }

      const conflictMap: Record<string, number[]> = {};
      const conflictDetailsMap: Record<string, Record<number, CrewConflictDetail>> = {};
      for (const [scheduleIndex, schedule] of crewStepSchedules.entries()) {
        for (const assignment of assignmentRows) {
          const scheduleRows = Array.isArray((assignment as any).job_schedules)
            ? (assignment as any).job_schedules
            : [(assignment as any).job_schedules];

          for (const scheduleRow of scheduleRows) {
            if (!scheduleRow || scheduleRow.scheduled_date !== schedule.date) continue;

            const hasOverlap =
              !schedule.timeStart ||
              !schedule.timeEnd ||
              !scheduleRow.scheduled_time_start ||
              !scheduleRow.scheduled_time_end ||
              (
                schedule.timeStart < scheduleRow.scheduled_time_end &&
                schedule.timeEnd > scheduleRow.scheduled_time_start
              );

            if (!hasOverlap) continue;

            const crewId = (assignment as any).user_id
              || ((assignment as any).mock_crew_profile_id
                ? buildMockCrewAssigneeId((assignment as any).mock_crew_profile_id)
                : "");
            if (!crewId) continue;

            if (!conflictMap[crewId]) {
              conflictMap[crewId] = [];
            }
            if (!conflictMap[crewId].includes(scheduleIndex)) {
              conflictMap[crewId].push(scheduleIndex);
            }

            if (!conflictDetailsMap[crewId]) {
              conflictDetailsMap[crewId] = {};
            }
            if (!conflictDetailsMap[crewId][scheduleIndex]) {
              conflictDetailsMap[crewId][scheduleIndex] = {
                jobTitle: "Another job",
                scheduledDate: scheduleRow.scheduled_date,
                scheduledTimeStart: scheduleRow.scheduled_time_start,
                scheduledTimeEnd: scheduleRow.scheduled_time_end,
              };
            }
          }
        }
      }

      setCrewConflictByMember(conflictMap);
      setCrewConflictDetailsByMember(conflictDetailsMap);
      setCrewByScheduleIndex((current) => {
        let changed = false;
        const next: Record<number, string[]> = {};

        for (const [rawIndex, assignedCrewIds] of Object.entries(current)) {
          const scheduleIndex = Number(rawIndex);
          const filteredCrewIds = assignedCrewIds.filter(
            (crewId) => !(conflictMap[crewId] || []).includes(scheduleIndex),
          );
          if (filteredCrewIds.length !== assignedCrewIds.length) {
            changed = true;
          }
          if (filteredCrewIds.length > 0) {
            next[scheduleIndex] = filteredCrewIds;
          }
        }

        return changed ? next : current;
      });

      setActiveCrewId((current) => {
        if (!current) return current;
        const conflicts = conflictMap[current] || [];
        const unavailableForAllDays =
          crewStepSchedules.length > 0 && conflicts.length >= crewStepSchedules.length;
        return unavailableForAllDays ? "" : current;
      });
      setIsLoadingCrewConflicts(false);
    };

    void loadCrewConflicts();

    return () => {
      isCancelled = true;
    };
  }, [open, step, currentAccount?.id, crewMemberIdsKey, scheduleConflictKey]);

  const isCrewAssignedToDay = (scheduleIndex: number, crewId: string) => {
    return (crewByScheduleIndex[scheduleIndex] || []).includes(crewId);
  };

  const isCrewConflictedOnDay = (scheduleIndex: number, crewId: string) => {
    return (crewConflictByMember[crewId] || []).includes(scheduleIndex);
  };

  const isCrewUnavailableForSelectedSchedules = (crewId: string) => {
    return crewStepSchedules.length > 0
      && crewStepSchedules.every((_, scheduleIndex) => isCrewConflictedOnDay(scheduleIndex, crewId));
  };

  const toggleSelectedCrewDay = (scheduleIndex: number) => {
    if (selectedCrewIds.length === 0) return;
    const eligibleCrewIds = selectedCrewIds.filter((crewId) => !isCrewConflictedOnDay(scheduleIndex, crewId));
    if (eligibleCrewIds.length === 0) return;

    const allEligibleAssigned = eligibleCrewIds.every((crewId) => isCrewAssignedToDay(scheduleIndex, crewId));

    setCrewByScheduleIndex((current) => {
      const existing = current[scheduleIndex] || [];
      const existingSet = new Set(existing);

      if (allEligibleAssigned) {
        eligibleCrewIds.forEach((crewId) => existingSet.delete(crewId));
      } else {
        eligibleCrewIds.forEach((crewId) => existingSet.add(crewId));
      }

      return {
        ...current,
        [scheduleIndex]: Array.from(existingSet),
      };
    });
  };

  const addSelectedCrew = (crewId: string) => {
    if (!validCrewIdSet.has(crewId)) return;
    setSelectedCrewIds((current) => (
      current.includes(crewId) ? current : [...current, crewId]
    ));
  };

  const removeCrewFromAllSchedules = (crewId: string) => {
    setSelectedCrewIds((current) => {
      const next = current.filter((id) => id !== crewId);
      if (activeCrewId === crewId) {
        setActiveCrewId(next[0] || "");
      }
      return next;
    });

    setCrewByScheduleIndex((current) => {
      const next: Record<number, string[]> = {};
      Object.entries(current).forEach(([rawIndex, crewIds]) => {
        const scheduleIndex = Number(rawIndex);
        const filtered = crewIds.filter((id) => id !== crewId);
        if (filtered.length > 0) {
          next[scheduleIndex] = filtered;
        }
      });
      return next;
    });
  };

  const handleSchedule = async () => {
    if (builderSchedules.length === 0 && !isEditingSchedules) {
      toast.error("Please add at least one schedule date");
      return;
    }

    for (const [scheduleIndex, _schedule] of builderSchedules.entries()) {
      const selectedCrewIds = (crewByScheduleIndex[scheduleIndex] || []).filter((crewId) => validCrewIdSet.has(crewId));
      const hasConflict = selectedCrewIds.some((crewId) => isCrewConflictedOnDay(scheduleIndex, crewId));
      if (hasConflict) {
        toast.error("One or more selected crew members are unavailable for this date and time.");
        return;
      }
    }

    const initialByDate = new Map(editableInitialScheduleEntries.map((schedule) => [schedule.date, schedule]));
    const currentByDate = new Map(builderSchedules.map((schedule) => [schedule.date, schedule]));
    const addedDateSet = new Set(
      builderSchedules
        .filter((schedule) => !initialByDate.has(schedule.date))
        .map((schedule) => schedule.date),
    );

    for (const [date, initialSchedule] of initialByDate.entries()) {
      if (currentByDate.has(date)) continue;
      const scheduleId = editableInitialScheduleIdByDate[date];
      if (!scheduleId) continue;
      try {
        await deleteSchedule.mutateAsync({ id: scheduleId, lead_id: jobId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update schedule";
        toast.error(message);
        return;
      }
    }

    for (const [date, currentSchedule] of currentByDate.entries()) {
      const initialSchedule = initialByDate.get(date);
      if (!initialSchedule) continue;

      if (initialSchedule.timeStart === currentSchedule.timeStart && initialSchedule.timeEnd === currentSchedule.timeEnd) {
        continue;
      }

      const scheduleId = editableInitialScheduleIdByDate[date];
      if (!scheduleId) continue;

      try {
        await updateSchedule.mutateAsync({
          id: scheduleId,
          scheduled_time_start: currentSchedule.timeStart || null,
          scheduled_time_end: currentSchedule.timeEnd || null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update schedule";
        toast.error(message);
        return;
      }
    }

    const scheduleIdByDate: Record<string, string> = { ...editableInitialScheduleIdByDate };
    let assignmentFailed = false;
    for (const [scheduleIndex, schedule] of builderSchedules.entries()) {
      if (!addedDateSet.has(schedule.date)) continue;

      const result = await scheduleJob({
        leadId: jobId,
        scheduledDate: schedule.date,
        startTime: schedule.timeStart || undefined,
        endTime: schedule.timeEnd || undefined,
        suppressSuccessToast: true,
      });

      if (!result.ok || !result.scheduleId) {
        return;
      }

      scheduleIdByDate[schedule.date] = result.scheduleId;
    }

    for (const [rawIndex, selectedCrew] of Object.entries(crewByScheduleIndex)) {
      const scheduleIndex = Number(rawIndex);
      const schedule = builderSchedules[scheduleIndex];
      if (!schedule) continue;

      const scheduleId = scheduleIdByDate[schedule.date];
      if (!scheduleId) continue;

      const selectedCrewIds = selectedCrew.filter((crewId) => validCrewIdSet.has(crewId));

      const { error: clearError } = await supabase
        .from("job_assignments")
        .delete()
        .eq("lead_id", jobId)
        .eq("job_schedule_id", scheduleId);

      if (clearError) {
        assignmentFailed = true;
        continue;
      }

      if (selectedCrewIds.length > 0 && currentAccount?.id && user?.id) {
        for (const crewId of selectedCrewIds) {
          try {
            await assignCrewAsync({ assigneeId: crewId, scheduleId });
          } catch {
            assignmentFailed = true;
          }
        }
      }
    }

    toast.success(isEditingSchedules ? "Schedule updated successfully!" : "Schedule added successfully!");

    if (assignmentFailed) {
      toast.error("Schedule added, but one or more crew assignments failed. Please review crew assignments.");
    }

    setBuilderSchedules([]);
    setStep("schedule");
    setCrewByScheduleIndex({});
    setCrewConflictByMember({});
    setCrewConflictDetailsByMember({});
    setCrewSearchQuery("");
    setSelectedCrewIds([]);
    setActiveCrewId("");
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (builderSchedules.length === 0 && !isEditingSchedules) {
      toast.error("Please add at least one schedule date");
      return;
    }
    if (isSinglePersonCompany) {
      void handleSchedule();
      return;
    }
    setStep("crew-assignment");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setBuilderSchedules([]);
      setStep("schedule");
      setCrewByScheduleIndex({});
      setCrewConflictByMember({});
      setCrewConflictDetailsByMember({});
      setCrewSearchQuery("");
      setSelectedCrewIds([]);
      setActiveCrewId("");
    }
    onOpenChange(newOpen);
  };

  const handleMakeRecurring = () => {
    handleOpenChange(false);
    onMakeRecurring?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{isEditingSchedules ? "Edit Schedule" : "Add Schedule Date"}</DialogTitle>
          <DialogDescription>
            {isEditingSchedules
              ? "Edit scheduled dates and times for this job."
              : isSinglePersonCompany
                ? "Schedule a date for this job."
                : "Schedule a date and optionally assign one or more crew members."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {step === "schedule" || isSinglePersonCompany ? (
            <ScheduleDateBuilder
              schedules={builderSchedules}
              onSchedulesChange={(schedules) => {
                setBuilderSchedules(schedules);
              }}
              ignoreExistingScheduleConstraints={isSinglePersonCompany}
              currentLeadId={jobId}
              recurringControls={onMakeRecurring ? (
                <div className="relative grid grid-cols-2 rounded-full border border-border bg-muted p-1">
                  <div className="pointer-events-none absolute inset-1 grid grid-cols-2 gap-1">
                    <div className="rounded-full bg-background shadow-sm" />
                    <div />
                  </div>
                  <div className="relative z-10 flex h-9 items-center justify-center rounded-full text-sm font-medium text-foreground">
                    One Off
                  </div>
                  <button
                    type="button"
                    className="relative z-10 h-9 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={handleMakeRecurring}
                  >
                    Recurring
                  </button>
                </div>
              ) : undefined}
            />
          ) : (
            <CreateJobCrewAssignmentStep
              addedSchedules={crewStepSchedules}
              crewMembers={crewMembers}
              assignedCrewByScheduleIndex={crewByScheduleIndex}
              filteredCrewMembers={filteredCrewMembers}
              crewSearchQuery={crewSearchQuery}
              onCrewSearchQueryChange={setCrewSearchQuery}
              selectedCrewIds={selectedCrewIds}
              onAddSelectedCrew={addSelectedCrew}
              activeCrewId={activeCrewId}
              onActiveCrewIdChange={setActiveCrewId}
              crewConflictByMember={crewConflictByMember}
              isLoadingCrewConflicts={isLoadingCrewConflicts}
              isCrewUnavailableForSelectedSchedules={isCrewUnavailableForSelectedSchedules}
              isCrewAssignedToDay={isCrewAssignedToDay}
              isCrewConflictedOnDay={isCrewConflictedOnDay}
              getCrewConflictDetail={(scheduleIndex, crewId) =>
                crewConflictDetailsByMember[crewId]?.[scheduleIndex] || null
              }
              onToggleSelectedCrewDay={toggleSelectedCrewDay}
              onRemoveSelectedCrew={removeCrewFromAllSchedules}
            />
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {step === "schedule" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={(!isEditingSchedules && builderSchedules.length === 0) || isScheduling}
                className="w-full"
              >
                {isSinglePersonCompany ? (isEditingSchedules ? "Save Schedule" : "Add Schedule") : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("schedule")} className="w-full">
                Back
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={(!isEditingSchedules && builderSchedules.length === 0) || isScheduling || isAssigning || isLoadingCrewConflicts}
                className="w-full"
              >
                {isScheduling || isAssigning ? "Scheduling..." : isEditingSchedules ? "Save Schedule" : "Add Schedule"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
