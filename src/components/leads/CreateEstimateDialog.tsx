// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, FileText, Users, Plus, X, Search, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineItemsEstimateDialog } from "./LineItemsEstimateDialog";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";


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
  const [confirmNoCrewOpen, setConfirmNoCrewOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [addedSchedules, setAddedSchedules] = useState<Array<{date: string; timeStart: string; timeEnd: string}>>([]);
  const [showCrewAssignment, setShowCrewAssignment] = useState(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<string>("");
  const [selectedSchedulesForCrew, setSelectedSchedulesForCrew] = useState<number[]>([]);
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [createAsRegularJob, setCreateAsRegularJob] = useState(false);

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

  const filteredCrewMembers = crewMembers.filter(member => {
    if (!crewSearchQuery) return true;
    const query = crewSearchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query)
    );
  });

  const handleAddSchedule = () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    const newSchedule = {
      date: format(selectedDate, "yyyy-MM-dd"),
      timeStart: scheduledTimeStart,
      timeEnd: scheduledTimeEnd,
    };

    setAddedSchedules([...addedSchedules, newSchedule]);
    setSelectedDate(undefined);
    setScheduledTimeStart("");
    setScheduledTimeEnd("");
    toast.success("Schedule date added");
  };

  const handleRemoveSchedule = (index: number) => {
    setAddedSchedules(addedSchedules.filter((_, i) => i !== index));
    setSelectedSchedulesForCrew(selectedSchedulesForCrew.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const toggleScheduleForCrew = (index: number) => {
    setSelectedSchedulesForCrew(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const toggleAllSchedules = () => {
    if (selectedSchedulesForCrew.length === addedSchedules.length) {
      setSelectedSchedulesForCrew([]);
    } else {
      setSelectedSchedulesForCrew(addedSchedules.map((_, i) => i));
    }
  };

  const handleScheduleEstimate = async (forceWithoutCrew = false) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    if (addedSchedules.length === 0) {
      toast.error("Please add at least one schedule date");
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

      loadingToast = toast.loading(createAsRegularJob ? "Scheduling job..." : "Scheduling estimate...");

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
          is_estimate_visit: !createAsRegularJob,
          name: createAsRegularJob ? lead.name : `${lead.name}, Estimate`,
          approval_status: "approved",
        })
        .eq("id", lead.id)
        .neq("status", "job");

      if (convertError) {
        if (convertError.message.includes("row-level security") || convertError.message.includes("policy")) {
          throw new Error("Unable to schedule this visit. Please check your permissions or contact support.");
        }
        throw new Error(`Failed to schedule visit: ${convertError.message}`);
      }

      leadWasConverted = true;

      const createdScheduleIds: string[] = [];

      for (const schedule of addedSchedules) {
        const { data: scheduleRow, error: scheduleError } = await supabase
          .from("job_schedules")
          .insert({
            lead_id: lead.id,
            scheduled_date: schedule.date,
            scheduled_time_start: schedule.timeStart || null,
            scheduled_time_end: schedule.timeEnd || null,
            created_by: user.id,
            account_id: currentAccount.id,
          })
          .select()
          .single();

        if (scheduleError) {
          for (const schedId of createdScheduleIds) {
            await supabase.from("job_schedules").delete().eq("id", schedId);
          }
          if (leadWasConverted) {
            await supabase
              .from("leads")
              .update({ status: "qualified", is_estimate_visit: false })
              .eq("id", lead.id);
          }
          if (scheduleError.message.includes("row-level security") || scheduleError.message.includes("policy")) {
            throw new Error("Unable to create schedule. Please check your permissions or contact support.");
          }
          throw new Error(`Failed to create schedule: ${scheduleError.message}`);
        }

        createdScheduleIds.push(scheduleRow.id);
      }

      if (!createAsRegularJob) {
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
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: createAsRegularJob ? "Job scheduled" : "Estimate visit scheduled",
        body: createAsRegularJob
          ? `Job scheduled for ${addedSchedules.length} date${addedSchedules.length > 1 ? 's' : ''}.`
          : `Estimate visit scheduled for ${addedSchedules.length} date${addedSchedules.length > 1 ? 's' : ''}.`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success(createAsRegularJob ? "Job scheduled!" : "Estimate visit scheduled!");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });
      await queryClient.invalidateQueries({ queryKey: ["job-assignments", lead.id] });
      await queryClient.invalidateQueries({ queryKey: ["job-schedules", lead.id] });

      onOpenChange(false);
      setAddedSchedules([]);
      setSelectedSchedulesForCrew([]);
      setSelectedCrewMember("");
      setCreateAsRegularJob(false);
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createAsRegularJob ? "Schedule Job" : "Schedule Estimate Visit"}</DialogTitle>
            <DialogDescription>
              Add schedule dates, then optionally assign crew members to specific dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Add Schedule Dates
              </Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
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
                </div>

                <div className="space-y-3">
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

                  <Button
                    onClick={handleAddSchedule}
                    disabled={!selectedDate}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule Date
                  </Button>

                  {addedSchedules.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium">Added Schedules ({addedSchedules.length})</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {addedSchedules.map((schedule, index) => {
                          const [year, month, day] = schedule.date.split('-').map(Number);
                          const localDate = new Date(year, month - 1, day);
                          return (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="text-sm">
                                <div className="font-medium">
                                  {format(localDate, "EEEE, MMM d, yyyy")}
                                </div>
                                {schedule.timeStart && schedule.timeEnd && (
                                  <div className="text-xs text-muted-foreground">
                                    {schedule.timeStart} - {schedule.timeEnd}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSchedule(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!hasEstimate && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="regular-job-toggle" className="text-sm font-normal cursor-pointer">
                    Create regular job instead of estimate visit
                  </Label>
                  <Switch
                    id="regular-job-toggle"
                    checked={createAsRegularJob}
                    onCheckedChange={setCreateAsRegularJob}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scheduling}>
              Cancel
            </Button>
            <Button
              onClick={() => handleScheduleEstimate()}
              disabled={scheduling || addedSchedules.length === 0}
            >
              {scheduling
                ? "Scheduling..."
                : `Schedule ${addedSchedules.length} Date${addedSchedules.length !== 1 ? 's' : ''}`
              }
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
              You're about to schedule this estimate without assigning a crew. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmNoCrewOpen(false)}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNoCrewOpen(false);
                handleScheduleEstimate(true);
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
