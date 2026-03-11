// @ts-nocheck
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, FileText, Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineItemsEstimateDialog } from "./LineItemsEstimateDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobSchedules } from "@/hooks/useJobSchedules";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";


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

interface CreateEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasEstimate?: boolean;
  lead: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    service_type: string | null;
    estimated_value: number | null;
  };
  onSuccess: () => void;
}

export function CreateEstimateDialog({ open, onOpenChange, hasEstimate = false, lead, onSuccess }: CreateEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  type CrewMember = { user_id: string; full_name: string | null; email: string | null; role: string | null };

  const [scheduling, setScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const scheduledDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [confirmNoCrewOpen, setConfirmNoCrewOpen] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
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
    enabled: !!user,
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
    enabled: !!currentAccount,
  });

  const { data: schedules = [] } = useJobSchedules(lead?.id);

  const toggleSchedule = (id: string) => {
    setSelectedSchedules((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAllSchedules = () => {
    if (selectedSchedules.length === schedules.length) {
      setSelectedSchedules([]);
    } else {
      setSelectedSchedules(schedules.map((s) => s.id));
    }
  };

  const toggleCrewMember = (userId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSchedule = async (forceWithoutCrew = false) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    if (!scheduledDate) {
      toast.error("Please select a date for the estimate visit");
      return;
    }

    if (selectedCrewIds.length === 0 && !forceWithoutCrew) {
      setConfirmNoCrewOpen(true);
      return;
    }
    if (selectedCrewIds.length > 0 && schedules.length > 0 && selectedSchedules.length === 0) {
      toast.error("Select at least one schedule date to assign crew");
      return;
    }

    if (scheduling) {
      return;
    }

    setScheduling(true);
    let loadingToast: string | number | undefined;

    try {
      const { data: currentLead } = await supabase
        .from("leads")
        .select("status, is_estimate_visit")
        .eq("id", lead.id)
        .single();

      if (currentLead?.status === "job" && currentLead?.is_estimate_visit) {
        toast.error("This lead is already scheduled as an estimate visit");
        setScheduling(false);
        return;
      }

      if (selectedCrewIds.length > 0) {
        const scheduleIds = selectedSchedules.length > 0 ? selectedSchedules : [];
        const datesToCheck = scheduleIds.length > 0
          ? await supabase
              .from("job_schedules")
              .select("scheduled_date, scheduled_time_start, scheduled_time_end")
              .in("id", scheduleIds)
          : { data: [{ scheduled_date: scheduledDate, scheduled_time_start: scheduledTimeStart || null, scheduled_time_end: scheduledTimeEnd || null }] };

        if (datesToCheck.data) {
          for (const scheduleToCheck of datesToCheck.data) {
            const { data: conflicts } = await supabase
              .from("job_assignments")
              .select(`
                user_id,
                job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end),
                profiles!inner(full_name)
              `)
              .in("user_id", selectedCrewIds)
              .eq("job_schedules.scheduled_date", scheduleToCheck.scheduled_date);

            if (conflicts && conflicts.length > 0) {
              const conflictingMembers = conflicts
                .map((c: any) => c.profiles?.full_name || "Unknown")
                .filter((name, index, self) => self.indexOf(name) === index);

              toast.error(
                `Scheduling conflict: ${conflictingMembers.join(", ")} ${conflictingMembers.length > 1 ? "are" : "is"} already assigned to another job on ${format(new Date(scheduleToCheck.scheduled_date), "MMM d, yyyy")}`
              );
              setScheduling(false);
              return;
            }
          }
        }
      }

      loadingToast = toast.loading("Scheduling estimate...");

      const { id: customerId } = await findOrCreateCustomer({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address || lead.city,
        city: lead.city,
        created_by: user.id,
        account_id: currentAccount.id,
      });

      let leadWasConverted = false;

      const { error: convertError } = await supabase
        .from("leads")
        .update({
          customer_id: customerId,
          status: "job",
          is_estimate_visit: true,
          name: `${lead.name}, Estimate`,
          approval_status: "approved",
        })
        .eq("id", lead.id)
        .neq("status", "job");

      if (convertError) {
        throw new Error(`Failed to convert lead to estimate job: ${convertError.message}`);
      }

      leadWasConverted = true;

      const { data: scheduleRow, error: scheduleError } = await supabase
        .from("job_schedules")
        .insert({
          lead_id: lead.id,
          scheduled_date: scheduledDate,
          scheduled_time_start: scheduledTimeStart || null,
          scheduled_time_end: scheduledTimeEnd || null,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (scheduleError) {
        if (leadWasConverted) {
          await supabase
            .from("leads")
            .update({ status: "qualified", is_estimate_visit: false })
            .eq("id", lead.id);
        }
        throw new Error(`Failed to schedule estimate visit: ${scheduleError.message}`);
      }

      if (selectedCrewIds.length > 0) {
        const scheduleIds = selectedSchedules.length > 0 ? selectedSchedules : [scheduleRow.id];
        const assignments = scheduleIds.flatMap((sid) =>
          selectedCrewIds.map((userId) => ({
            lead_id: lead.id,
            user_id: userId,
            job_schedule_id: sid,
            account_id: currentAccount.id,
            assigned_by: user.id,
          }))
        );

        const { error: assignError } = await supabase
          .from("job_assignments")
          .insert(assignments);

        if (assignError) {
          await supabase.from("job_schedules").delete().eq("id", scheduleRow.id);
          if (leadWasConverted) {
            await supabase
              .from("leads")
              .update({ status: "qualified", is_estimate_visit: false })
              .eq("id", lead.id);
          }
          throw new Error(`Failed to assign crew: ${assignError.message}`);
        }
      }

      const { data: existingEstimate, error: estimateCheckError } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", lead.id)
        .maybeSingle();

      if (estimateCheckError) {
        console.error("Error checking for existing estimate:", estimateCheckError);
      }

      if (!existingEstimate) {
        const { error: estimateError } = await supabase
          .from("estimates")
          .insert({
            customer_id: customerId,
            job_id: lead.id,
            subtotal: 0,
            profit_margin: currentAccount?.default_profit_margin ?? 0,
            tax_rate: (currentAccount?.default_tax_rate ?? 0) / 100,
            tax: 0,
            discount: 0,
            total: 0,
            status: "draft",
            created_by: user.id,
            account_id: currentAccount.id,
          });

        if (estimateError && !estimateError.message.includes("duplicate key")) {
          console.error("Error creating estimate:", estimateError);
        }
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: "Estimate visit scheduled",
        body: `Estimate visit scheduled for ${scheduledDate}.`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Estimate visit scheduled!");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });
      await queryClient.invalidateQueries({ queryKey: ["job-assignments", lead.id] });
      await queryClient.invalidateQueries({ queryKey: ["job-schedules", lead.id] });

      onOpenChange(false);
      setSelectedCrewIds([]);
      setSelectedSchedules([]);
      navigate(`/jobs/${lead.id}`);
    } catch (error) {
      console.error("Error scheduling estimate:", error);
      if (loadingToast) toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to schedule estimate");
      setScheduling(false);
    } finally {
      if (scheduling) {
        setScheduling(false);
      }
    }
  };

  const handleCreateEstimateClick = () => {
    if (hasEstimate) return;
    onOpenChange(false);
    setLineItemsOpen(true);
  };

  const handleLineItemsSuccess = () => {
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Estimate</DialogTitle>
            <DialogDescription>
              Schedule an estimate visit for {lead.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Visit Date & Time
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

            <div className="space-y-4 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assign Crew (optional)
                </Label>
                {schedules.length > 0 && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={toggleAllSchedules}
                  >
                    {selectedSchedules.length === schedules.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {!scheduledDate ? (
                <div className="text-sm text-muted-foreground border rounded-md p-3">
                  Select a date above to assign crew
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Crew Members</Label>
                    {crewMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active crew members available.</p>
                    ) : (
                      <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                        {crewMembers.map((member) => (
                          <label
                            key={member.user_id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCrewIds.includes(member.user_id)}
                              onChange={() => toggleCrewMember(member.user_id)}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <span>{member.full_name || "Unnamed"}</span>
                              {member.role && (
                                <Badge variant="outline" className={`text-xs py-0 ${roleBadgeColors[member.role] || ''}`}>
                                  {roleLabels[member.role] || member.role}
                                </Badge>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {schedules.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Existing Schedules</Label>
                      <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                        {schedules.map((schedule) => (
                          <label
                            key={schedule.id}
                            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedSchedules.includes(schedule.id)}
                              onChange={() => toggleSchedule(schedule.id)}
                            />
                            <div>
                              <div className="font-medium">
                                {format(new Date(schedule.scheduled_date), "EEEE, MMM d, yyyy")}
                              </div>
                              {schedule.scheduled_time_start && schedule.scheduled_time_end && (
                                <div className="text-xs text-muted-foreground">
                                  {schedule.scheduled_time_start} - {schedule.scheduled_time_end}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedCrewIds.length === 0 && scheduledDate && (
                <p className="text-xs text-muted-foreground">
                  You can schedule without assigning crew; we'll ask for confirmation.
                </p>
              )}
            </div>

            {!hasEstimate && (
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleCreateEstimateClick}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Create regular job instead
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scheduling}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={scheduling || !scheduledDate}
            >
              {scheduling ? "Scheduling..." : "Schedule Estimate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LineItemsEstimateDialog
        open={lineItemsOpen}
        onOpenChange={setLineItemsOpen}
        lead={lead}
        onSuccess={handleLineItemsSuccess}
      />

      <AlertDialog open={confirmNoCrewOpen} onOpenChange={setConfirmNoCrewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No crew assigned</AlertDialogTitle>
            <AlertDialogDescription>
              You’re about to schedule this estimate without assigning a crew. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmNoCrewOpen(false)}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNoCrewOpen(false);
                handleSchedule(true);
              }}
            >
              Yes, schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
