import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineItemsEstimateDialog } from "./LineItemsEstimateDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobSchedules } from "@/hooks/useJobSchedules";
import { format } from "date-fns";

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
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState<string>("");
  const [confirmNoCrewOpen, setConfirmNoCrewOpen] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);

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

  const handleSchedule = async (forceWithoutCrew = false) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    if (!scheduledDate) {
      toast.error("Please select a date for the estimate visit");
      return;
    }

    if (!selectedCrewId && !forceWithoutCrew) {
      setConfirmNoCrewOpen(true);
      return;
    }
    if (selectedCrewId && selectedSchedules.length === 0) {
      toast.error("Select at least one schedule date to assign the crew");
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

      loadingToast = toast.loading("Scheduling estimate...");

      let customerId = null;

      if (lead.phone) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", lead.phone)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            address: lead.address || lead.city,
            city: lead.city,
            created_by: user.id,
            account_id: currentAccount.id,
          })
          .select()
          .single();

        if (customerError) throw new Error("Failed to create customer");
        customerId = newCustomer.id;
      }

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

      if (convertError) throw new Error("Failed to convert lead to estimate job");

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

      if (scheduleError) throw new Error("Failed to schedule estimate visit");

      if (selectedCrewId) {
        const scheduleIds = selectedSchedules.length > 0 ? selectedSchedules : [scheduleRow.id];
        const assignments = scheduleIds.map((sid) => ({
          lead_id: lead.id,
          user_id: selectedCrewId,
          job_schedule_id: sid,
          account_id: currentAccount.id,
          assigned_by: user.id,
        }));

        const { error: assignError } = await supabase
          .from("job_assignments")
          .insert(assignments);

        if (assignError) throw new Error("Scheduled, but failed to assign crew");
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
            subtotal: lead.estimated_value || 0,
            tax_rate: 0,
            tax: 0,
            discount: 0,
            total: lead.estimated_value || 0,
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
      setSelectedCrewId("");
      setSelectedSchedules([]);
      navigate(`/jobs/${lead.id}`);
    } catch (error) {
      console.error("Error scheduling estimate:", error);
      if (loadingToast) toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to schedule estimate");
    } finally {
      setScheduling(false);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Estimate</DialogTitle>
            <DialogDescription>
              Schedule an estimate visit for {lead.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visit Date & Time
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="schedule-date">Date *</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
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
                    <Label className="text-sm font-medium mb-1 block">Crew Member</Label>
                    {crewMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active crew members available.</p>
                    ) : (
                      <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select crew member" />
                        </SelectTrigger>
                        <SelectContent>
                          {crewMembers.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.full_name || "Unnamed"} {member.role ? `• ${member.role}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

              {selectedCrewId === "" && scheduledDate && (
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
                  Create estimate instead
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
