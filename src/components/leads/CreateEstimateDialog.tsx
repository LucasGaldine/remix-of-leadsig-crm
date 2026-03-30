// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { LineItemsEstimateDialog } from "./LineItemsEstimateDialog";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { buildDefaultJobName } from "@/lib/defaultJobName";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScheduleDateBuilder, type ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";


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
  const [scheduling, setScheduling] = useState(false);
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [confirmNoCrewOpen, setConfirmNoCrewOpen] = useState(false);
  const [addedSchedules, setAddedSchedules] = useState<ScheduleEntry[]>([]);
  const [showCrewAssignment, setShowCrewAssignment] = useState(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<string>("");
  const [selectedSchedulesForCrew, setSelectedSchedulesForCrew] = useState<number[]>([]);
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [createAsRegularJob, setCreateAsRegularJob] = useState(false);

  const { data: crewMembers = [] } = useTeamMembers();

  const filteredCrewMembers = crewMembers.filter(member => {
    if (!crewSearchQuery) return true;
    const query = crewSearchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query)
    );
  });

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
          name: buildDefaultJobName({
            customerName: lead.name,
            serviceType: lead.service_type,
            isEstimateVisit: !createAsRegularJob,
          }),
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
            <ScheduleDateBuilder
              schedules={addedSchedules}
              onSchedulesChange={setAddedSchedules}
            />

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
