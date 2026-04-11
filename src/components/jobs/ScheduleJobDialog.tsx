import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { buildMockCrewAssigneeId, parseCrewAssigneeId } from "@/lib/crewIdentifiers";
import { ScheduleDateTimePicker, type ScheduledDateJob } from "@/components/scheduling/ScheduleDateTimePicker";

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  admin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-600 border-green-500/20',
  crew_lead: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  crew_member: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

interface ScheduleJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName?: string;
  hasSchedules?: boolean;
  onMakeRecurring?: () => void;
}

export function ScheduleJobDialog({ 
  open, 
  onOpenChange, 
  jobId, 
  jobName,
  hasSchedules = false,
  onMakeRecurring 
}: ScheduleJobDialogProps) {
  const { user, currentAccount } = useAuth();
  const { scheduleJob, isScheduling } = useScheduleJob();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const scheduledDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Fetch busy dates for the visible month range
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(addMonths(calendarMonth, 1));

  const { data: busyDatesSet } = useQuery({
    queryKey: ["busy-dates", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_schedules")
        .select("scheduled_date")
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"));

      if (error) throw error;
      const dates = new Set<string>();
      data?.forEach((s) => { if (s.scheduled_date) dates.add(s.scheduled_date); });
      return dates;
    },
    enabled: !!user && open,
  });

  // Fetch jobs for the selected date
  const { data: selectedDateJobs = [] } = useScheduledJobs(scheduledDate);

  const { data: crewMembers = [] } = useTeamMembers();

  const toggleCrewSelection = (crewId: string) => {
    setSelectedCrewIds((current) =>
      current.includes(crewId)
        ? current.filter((id) => id !== crewId)
        : [...current, crewId],
    );
  };

  const handleSchedule = async () => {
    if (!scheduledDate) {
      toast.error("Please select a date");
      return;
    }

    if (selectedCrewIds.length > 0) {
      const parsedCrew = selectedCrewIds.map((crewId) => parseCrewAssigneeId(crewId));
      const realCrewIds = parsedCrew
        .filter((crew) => crew.type === "user" && crew.userId)
        .map((crew) => crew.userId as string);
      const mockCrewIds = parsedCrew
        .filter((crew) => crew.type === "mock" && crew.mockProfileId)
        .map((crew) => crew.mockProfileId as string);
      const conflicts: any[] = [];

      if (realCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select(`
            user_id,
            mock_crew_profile_id,
            job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end)
          `)
          .in("user_id", realCrewIds)
          .eq("job_schedules.scheduled_date", scheduledDate);
        if (error) throw error;
        conflicts.push(...(data || []));
      }

      if (mockCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select(`
            user_id,
            mock_crew_profile_id,
            job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end)
          `)
          .in("mock_crew_profile_id", mockCrewIds)
          .eq("job_schedules.scheduled_date", scheduledDate);
        if (error) throw error;
        conflicts.push(...(data || []));
      }

      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictId = conflict?.user_id
          || (conflict?.mock_crew_profile_id ? buildMockCrewAssigneeId(conflict.mock_crew_profile_id) : selectedCrewIds[0]);
        const crewMemberName = crewMembers.find((member) => member.user_id === conflictId)?.full_name || "This crew member";
        toast.error(
          `Scheduling conflict: ${crewMemberName} is already assigned to another job on ${format(new Date(scheduledDate), "MMM d, yyyy")}`
        );
        return;
      }
    }

    const result = await scheduleJob({
      leadId: jobId,
      scheduledDate,
      startTime: scheduledTimeStart || undefined,
      endTime: scheduledTimeEnd || undefined,
    });

    if (!result.ok || !result.scheduleId) {
      return;
    }

    if (selectedCrewIds.length > 0 && currentAccount && user) {
      for (const crewId of selectedCrewIds) {
        const parsedCrew = parseCrewAssigneeId(crewId);
        const overlapFn = parsedCrew.type === "user" ? "check_assignment_overlap" : "check_mock_assignment_overlap";
        const overlapArgs = parsedCrew.type === "user"
          ? {
              p_user_id: parsedCrew.userId,
              p_schedule_id: result.scheduleId,
              p_account_id: currentAccount.id,
            }
          : {
              p_mock_profile_id: parsedCrew.mockProfileId,
              p_schedule_id: result.scheduleId,
              p_account_id: currentAccount.id,
            };
        const { data: hasOverlap } = await supabase.rpc(overlapFn, overlapArgs as any);

        if (hasOverlap) {
          const crewName = crewMembers.find((member) => member.user_id === crewId)?.full_name || "This crew member";
          const dateStr = scheduledDate
            ? format(new Date(scheduledDate), "EEEE, MMMM d, yyyy")
            : 'the selected date';

          toast.error(`${crewName} is already assigned to another job on ${dateStr}. Please choose a different date or crew member.`, { duration: 5000 });
          return;
        }
      }

      const { error: assignError } = await supabase
        .from("job_assignments")
        .insert(
          selectedCrewIds.map((crewId) => {
            const parsedCrew = parseCrewAssigneeId(crewId);
            return {
              lead_id: jobId,
              user_id: parsedCrew.type === "user" ? parsedCrew.userId : null,
              mock_crew_profile_id: parsedCrew.type === "mock" ? parsedCrew.mockProfileId : null,
              job_schedule_id: result.scheduleId,
              account_id: currentAccount.id,
              assigned_by: user.id,
            };
          }),
        );

      if (assignError) {
        console.error("Failed to assign crew:", assignError);
        if (assignError.message.includes("row-level security") || assignError.message.includes("policy")) {
          toast.error("This crew member is already assigned to another job at this time. Please choose a different time or crew member.", { duration: 5000 });
        } else {
          toast.error(`Failed to assign crew: ${assignError.message}`);
        }
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-assignments", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["job", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["crew-hours"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] }),
      ]);
    }

    setSelectedDate(undefined);
    setScheduledTimeStart("");
    setScheduledTimeEnd("");
    setSelectedCrewIds([]);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedDate(undefined);
      setScheduledTimeStart("");
      setScheduledTimeEnd("");
      setSelectedCrewIds([]);
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
          <div className="space-y-3">
            <ScheduleDateTimePicker
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              calendarMonth={calendarMonth}
              onCalendarMonthChange={setCalendarMonth}
              disabledDate={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              scheduledTimeStart={scheduledTimeStart}
              onScheduledTimeStartChange={setScheduledTimeStart}
              scheduledTimeEnd={scheduledTimeEnd}
              onScheduledTimeEndChange={setScheduledTimeEnd}
              selectedDateJobs={selectedDateJobs as ScheduledDateJob[]}
              busyDatesSet={busyDatesSet}
              calendarClassName="rounded-md"
            >
              {selectedDate && selectedDateJobs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  No jobs scheduled on {format(selectedDate, "MMM d")}
                </p>
              )}

              {onMakeRecurring && (
                <div className="flex justify-start pt-1">
                  <Button variant="outline" onClick={handleMakeRecurring} className="gap-1.5">
                    <Repeat className="h-4 w-4" />
                    Make Recurring Instead
                  </Button>
                </div>
              )}
            </ScheduleDateTimePicker>
          </div>

          {/* Assign Crew */}
          {scheduledDate && crewMembers.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign Crew (optional)
              </Label>
              <div className="rounded-md border border-border max-h-48 overflow-y-auto">
                {crewMembers.map((member) => {
                  const checkboxId = `crew-member-${member.user_id}`;
                  const isSelected = selectedCrewIds.includes(member.user_id);

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={checkboxId}
                          checked={isSelected}
                          onCheckedChange={() => toggleCrewSelection(member.user_id)}
                        />
                        <Label htmlFor={checkboxId} className="font-normal cursor-pointer">
                          {member.full_name || "Unnamed"}
                        </Label>
                      </div>
                      {member.role && (
                        <Badge variant="outline" className={`text-xs py-0 ${roleBadgeColors[member.role] || ''}`}>
                          {roleLabels[member.role] || member.role}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedCrewIds.length > 0
                  ? `${selectedCrewIds.length} crew member${selectedCrewIds.length === 1 ? "" : "s"} selected`
                  : "No crew selected"}
              </p>
            </div>
          )}

        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!selectedDate || isScheduling}>
            {isScheduling ? "Scheduling..." : "Add Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
