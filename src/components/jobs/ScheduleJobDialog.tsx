import { useEffect, useMemo, useState } from "react";
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

interface ScheduleJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName?: string;
  hasSchedules?: boolean;
  onMakeRecurring?: () => void;
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
  onMakeRecurring 
}: ScheduleJobDialogProps) {
  const { scheduleJob, isScheduling } = useScheduleJob();
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
  const [activeCrewId, setActiveCrewId] = useState<string>("");
  const [isLoadingCrewConflicts, setIsLoadingCrewConflicts] = useState(false);
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
        .map((member) => member.userId as string);
      const mockCrewIds = parsedCrew
        .filter((member) => member.type === "mock" && member.mockProfileId)
        .map((member) => member.mockProfileId as string);

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
      const leadIds = Array.from(
        new Set(
          assignmentRows
            .flatMap((assignment) => {
              const scheduleRows = Array.isArray((assignment as any).job_schedules)
                ? (assignment as any).job_schedules
                : [(assignment as any).job_schedules];
              return scheduleRows
                .map((scheduleRow: any) => scheduleRow?.lead_id)
                .filter((leadId: unknown): leadId is string => Boolean(leadId));
            }),
        ),
      );
      const jobTitleByLeadId: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, title")
          .in("id", leadIds);
        for (const lead of leadsData || []) {
          jobTitleByLeadId[lead.id] = lead.title || "Another job";
        }
      }

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
                jobTitle: jobTitleByLeadId[scheduleRow.lead_id] || "Another job",
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

  const toggleCrewSelectionForSchedule = (scheduleIndex: number, crewId: string) => {
    setCrewByScheduleIndex((current) => {
      const existing = current[scheduleIndex] || [];
      const nextForSchedule = existing.includes(crewId)
        ? existing.filter((id) => id !== crewId)
        : [...existing, crewId];

      return {
        ...current,
        [scheduleIndex]: nextForSchedule,
      };
    });
  };

  const toggleSelectedCrewDay = (scheduleIndex: number) => {
    if (!activeCrewId) return;
    if (isCrewConflictedOnDay(scheduleIndex, activeCrewId)) return;
    toggleCrewSelectionForSchedule(scheduleIndex, activeCrewId);
  };

  const handleSchedule = async () => {
    if (builderSchedules.length === 0) {
      toast.error("Please add at least one schedule date");
      return;
    }

    for (const [scheduleIndex, _schedule] of builderSchedules.entries()) {
      const selectedCrewIds = crewByScheduleIndex[scheduleIndex] || [];
      const hasConflict = selectedCrewIds.some((crewId) => isCrewConflictedOnDay(scheduleIndex, crewId));
      if (hasConflict) {
        toast.error("One or more selected crew members are unavailable for this date and time.");
        return;
      }
    }

    let assignmentFailed = false;
    for (const [scheduleIndex, schedule] of builderSchedules.entries()) {
      const result = await scheduleJob({
        leadId: jobId,
        scheduledDate: schedule.date,
        startTime: schedule.timeStart || undefined,
        endTime: schedule.timeEnd || undefined,
      });

      if (!result.ok || !result.scheduleId) {
        return;
      }

      const selectedCrewIds = crewByScheduleIndex[scheduleIndex] || [];
      if (selectedCrewIds.length > 0 && currentAccount?.id && user?.id) {
        for (const crewId of selectedCrewIds) {
          try {
            await assignCrewAsync({ assigneeId: crewId, scheduleId: result.scheduleId });
          } catch {
            assignmentFailed = true;
          }
        }
      }
    }

    if (assignmentFailed) {
      toast.error("Schedule added, but one or more crew assignments failed. Please review crew assignments.");
    }

    setBuilderSchedules([]);
    setStep("schedule");
    setCrewByScheduleIndex({});
    setCrewConflictByMember({});
    setCrewConflictDetailsByMember({});
    setCrewSearchQuery("");
    setActiveCrewId("");
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (builderSchedules.length === 0) {
      toast.error("Please add at least one schedule date");
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
          <DialogTitle>Add Schedule Date</DialogTitle>
          <DialogDescription>Schedule a date and optionally assign one or more crew members.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {step === "schedule" ? (
            <ScheduleDateBuilder
              schedules={builderSchedules}
              onSchedulesChange={(schedules) => {
                setBuilderSchedules(schedules);
              }}
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
            />
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {step === "schedule" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
                Cancel
              </Button>
              <Button onClick={handleContinue} disabled={builderSchedules.length === 0 || isScheduling} className="w-full">
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("schedule")} className="w-full">
                Back
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={builderSchedules.length === 0 || isScheduling || isAssigning || isLoadingCrewConflicts}
                className="w-full"
              >
                {isScheduling || isAssigning ? "Scheduling..." : "Add Schedule"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
