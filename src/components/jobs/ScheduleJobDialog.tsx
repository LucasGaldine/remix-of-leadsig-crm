import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Users, Repeat } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

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
  
  type CrewMember = { user_id: string; full_name: string | null; email: string | null; role: string | null };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const scheduledDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [selectedCrewId, setSelectedCrewId] = useState<string>("");
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

  const { data: crewMembers = [] } = useQuery<CrewMember[]>({
    queryKey: ["crew-members", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("account_members_with_profiles")
        .select("user_id, full_name, email, role")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentAccount && open,
  });

  const handleSchedule = async () => {
    if (!scheduledDate) {
      toast.error("Please select a date");
      return;
    }

    if (selectedCrewId) {
      const { data: conflicts } = await supabase
        .from("job_assignments")
        .select(`
          user_id,
          job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end),
          profiles!inner(full_name)
        `)
        .eq("user_id", selectedCrewId)
        .eq("job_schedules.scheduled_date", scheduledDate);

      if (conflicts && conflicts.length > 0) {
        const crewMemberName = conflicts[0]?.profiles?.full_name || "This crew member";
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

    if (selectedCrewId && currentAccount && user) {
      const { data: hasOverlap } = await supabase.rpc('check_assignment_overlap', {
        p_user_id: selectedCrewId,
        p_schedule_id: result.scheduleId,
        p_account_id: currentAccount.id,
      });

      if (hasOverlap) {
        const { data: crewMemberProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', selectedCrewId)
          .maybeSingle();

        const crewName = crewMemberProfile?.full_name || 'This crew member';
        const dateStr = scheduledDate
          ? format(new Date(scheduledDate), "EEEE, MMMM d, yyyy")
          : 'the selected date';

        toast.error(`${crewName} is already assigned to another job on ${dateStr}. Please choose a different date or crew member.`, { duration: 5000 });
        return;
      }

      const { error: assignError } = await supabase
        .from("job_assignments")
        .insert({
          lead_id: jobId,
          user_id: selectedCrewId,
          job_schedule_id: result.scheduleId,
          account_id: currentAccount.id,
          assigned_by: user.id,
        });

      if (assignError) {
        console.error("Failed to assign crew:", assignError);
        if (assignError.message.includes("row-level security") || assignError.message.includes("policy")) {
          toast.error("This crew member is already assigned to another job at this time. Please choose a different time or crew member.", { duration: 5000 });
        } else {
          toast.error(`Failed to assign crew: ${assignError.message}`);
        }
        return;
      }
    }

    setSelectedDate(undefined);
    setScheduledTimeStart("");
    setScheduledTimeEnd("");
    setSelectedCrewId("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedDate(undefined);
      setScheduledTimeStart("");
      setScheduledTimeEnd("");
      setSelectedCrewId("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Schedule Date</DialogTitle>
          <DialogDescription>
            {jobName ? `Add a scheduled work date for "${jobName}".` : "Add a new scheduled work date for this job."}
            {hasSchedules && " You can add multiple dates for multi-day projects."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Work Date & Time
            </Label>

            {/* Inline Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={setCalendarMonth}
                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                className={cn("rounded-md border pointer-events-auto")}
                modifiers={{
                  busy: (date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    return busyDatesSet?.has(dateStr) || false;
                  },
                }}
                modifiersClassNames={{
                  busy: "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
                }}
              />
            </div>

            {/* Jobs on selected date */}
            {selectedDate && selectedDateJobs.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {selectedDateJobs.length} job{selectedDateJobs.length !== 1 ? "s" : ""} on {format(selectedDate, "MMM d")}:
                </p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {selectedDateJobs.map((job: any) => (
                    <div key={job.schedule_id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{job.name || "Unnamed job"}</span>
                      {job.scheduled_time_start && (
                        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                          {job.scheduled_time_start}{job.scheduled_time_end ? ` - ${job.scheduled_time_end}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDate && selectedDateJobs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">No jobs scheduled on {format(selectedDate, "MMM d")}</p>
            )}

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="schedule-start">Start Time</Label>
                <Input
                  id="schedule-start"
                  type="time"
                  value={scheduledTimeStart}
                  onChange={(e) => setScheduledTimeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end">End Time</Label>
                <Input
                  id="schedule-end"
                  type="time"
                  value={scheduledTimeEnd}
                  onChange={(e) => setScheduledTimeEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assign Crew */}
          {scheduledDate && crewMembers.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign Crew (optional)
              </Label>
              <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crew member" />
                </SelectTrigger>
                <SelectContent>
                  {crewMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <span className="flex items-center gap-2">
                        {member.full_name || "Unnamed"}
                        {member.role && (
                          <Badge variant="outline" className={`text-xs py-0 ${roleBadgeColors[member.role] || ''}`}>
                            {roleLabels[member.role] || member.role}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>

        <DialogFooter>
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
