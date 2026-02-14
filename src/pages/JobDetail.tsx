import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Clock,
  User,
  Users,
  Phone,
  MessageSquare,
  Navigation,
  CheckSquare,
  FileText,
  DollarSign,
  ChevronRight,
  Calendar,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
  Info,
  Unlink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useJob, useUpdateJob, useDeleteJob, useMakeJobUnique } from "@/hooks/useJobs";
import { useJobSchedules } from "@/hooks/useJobSchedules";
import { useAuth } from "@/hooks/useAuth";
import { JobAssignments } from "@/components/jobs/JobAssignments";
import { useJobAssignments } from "@/hooks/useJobAssignments";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { isOutsideBusinessHours } from "@/lib/businessHours";
import { Badge } from "@/components/ui/badge";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { PhotoSection } from "@/components/photos/PhotoSection";
import { ClientShareLink } from "@/components/jobs/ClientShareLink";
import { JobChecklist } from "@/components/jobs/JobChecklist";
import { useRecurringJob, useGenerateNextInstances, useUpdateRecurringJobCrew, useRecurringJobEstimate } from "@/hooks/useRecurringJobs";
import { MakeRecurringDialog } from "@/components/jobs/MakeRecurringDialog";
import { EditJobScheduleDialog } from "@/components/jobs/EditJobScheduleDialog";
import { RecurringJobDetailModal } from "@/components/jobs/RecurringJobDetailModal";
import { Repeat } from "lucide-react";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager, user, currentAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "photos" | "notes">("details");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressValue, setAddressValue] = useState("");
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    service_type: "",
    address: "",
    description: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
  });

  const queryClient = useQueryClient();
  const { data: job, isLoading, error } = useJob(id);
  const { data: schedules = [], isLoading: schedulesLoading } = useJobSchedules(id);
  const { businessHours } = useBusinessHours();
  const { scheduleJob, deleteSchedule, isScheduling } = useScheduleJob();
  const { assignments: jobAssignments = [] } = useJobAssignments(id);
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();
  const { data: recurringJobData } = useRecurringJob((job as any)?.recurring_job_id ?? undefined);
  const { data: recurringJobEstimate } = useRecurringJobEstimate((job as any)?.recurring_job_id ?? undefined);
  const generateNextInstances = useGenerateNextInstances();
  const updateRecurringCrew = useUpdateRecurringJobCrew();
  const [crewSavePromptOpen, setCrewSavePromptOpen] = useState(false);
  const [pendingCrewUserIds, setPendingCrewUserIds] = useState<string[]>([]);
  const [makeRecurringOpen, setMakeRecurringOpen] = useState(false);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [recurringDetailModalOpen, setRecurringDetailModalOpen] = useState(false);
  const [makeUniqueDialogOpen, setMakeUniqueDialogOpen] = useState(false);

  const [estimate, setEstimate] = useState<any>(null);
  const makeUnique = useMakeJobUnique();
  const [estimateLoading, setEstimateLoading] = useState(true);
  const [parentLeadId, setParentLeadId] = useState<string | null>(null);
  const [parentLeadToken, setParentLeadToken] = useState<string | null>(null);
  const [hasAfterPhotos, setHasAfterPhotos] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; body: string | null; summary: string | null; created_at: string; created_by: string | null }>>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEstimate();
      fetchParentLead();
      fetchAfterPhotos();
      fetchNotes();
    }
  }, [id]);

  const handleJobConverted = () => {
    queryClient.invalidateQueries({ queryKey: ["job", id] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Photos uploaded and lead has been converted to a job!");
  };

  const fetchParentLead = async () => {
    if (!id) return;

    try {
      const { data } = await supabase
        .from("leads")
        .select("id, client_share_token")
        .eq("estimate_job_id", id)
        .maybeSingle();

      if (data) {
        setParentLeadId(data.id);
        setParentLeadToken(data.client_share_token);
      }
    } catch (error) {
      console.error("Error fetching parent lead:", error);
    }
  };

  const fetchAfterPhotos = async () => {
    if (!id) return;
    try {
      const { count } = await supabase
        .from("lead_photos")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", id)
        .eq("photo_type", "after");
      setHasAfterPhotos((count ?? 0) > 0);
    } catch (error) {
      console.error("Error checking after photos:", error);
    }
  };

  const fetchNotes = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("interactions")
      .select("id, body, summary, created_at, created_by")
      .eq("lead_id", id)
      .eq("type", "note")
      .order("created_at", { ascending: false });
    if (data) setNotes(data);
  };

  const addNote = async () => {
    if (!newNote.trim() || !id) return;
    setAddingNote(true);
    const { error } = await supabase.from("interactions").insert({
      lead_id: id,
      account_id: currentAccount?.id,
      type: "note",
      direction: "na",
      body: newNote,
      summary: newNote.slice(0, 100),
      created_by: user?.id,
    });
    if (error) {
      toast.error("Failed to add note");
    } else {
      setNewNote("");
      fetchNotes();
      toast.success("Note added");
    }
    setAddingNote(false);
  };

  const fetchEstimate = async () => {
    if (!id) return;

    setEstimateLoading(true);
    try {
      const { data: currentJob } = await supabase
        .from("leads")
        .select("recurring_job_id")
        .eq("id", id)
        .maybeSingle();

      if (currentJob?.recurring_job_id) {
        const { data: masterQuote, error: quoteError } = await supabase
          .from("estimates")
          .select("id, total, status, line_items:estimate_line_items(id)")
          .eq("recurring_job_id", currentJob.recurring_job_id)
          .maybeSingle();

        if (quoteError) throw quoteError;
        setEstimate(masterQuote);
        setEstimateLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from("estimates")
        .select("id, total, status, line_items:estimate_line_items(id)")
        .eq("job_id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: parentLead } = await supabase
          .from("leads")
          .select("id")
          .eq("estimate_job_id", id)
          .maybeSingle();

        if (parentLead) {
          const { data: parentEstimate, error: parentError } = await supabase
            .from("estimates")
            .select("id, total, status, line_items:estimate_line_items(id)")
            .eq("job_id", parentLead.id)
            .maybeSingle();

          if (parentError) throw parentError;
          data = parentEstimate;
        }
      }

      setEstimate(data);
    } catch (error) {
      console.error("Error fetching estimate:", error);
    } finally {
      setEstimateLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Job Details" showBack backTo="/jobs" />
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Job not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const jobAny = job as any;
  const clientPhone = job.customer?.phone || "";
  const clientAddress = [job.address, job.city].filter(Boolean).join(", ");
  const hasSchedules = schedules && schedules.length > 0;
  const scheduledDatesText = hasSchedules
    ? schedules.length === 1
      ? format(new Date(schedules[0].scheduled_date + "T00:00:00"), "EEEE, MMM d, yyyy")
      : `${schedules.length} scheduled dates`
    : "Not scheduled";

  const handleCall = () => {
    if (clientPhone) window.open(`tel:${clientPhone}`);
  };

  const handleText = () => {
    if (clientPhone) window.open(`sms:${clientPhone}`);
  };

  const handleNavigate = () => {
    if (clientAddress) {
      const address = encodeURIComponent(clientAddress);
      window.open(`https://maps.google.com/?q=${address}`);
    }
  };

  const handleReceivedPayment = async () => {
    if (!id) return;

    try {
      await updateJobMutation.mutateAsync({
        id,
        status: "paid"
      });

      if (job?.recurring_job_id) {
        generateNextInstances.mutate(jobAny.recurring_job_id);
      }

      toast.success("Payment recorded successfully!");
      setCompleteDialogOpen(false);
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleSaveCrewForFuture = async () => {
    if (!job?.recurring_job_id || pendingCrewUserIds.length === 0) return;
    try {
      await updateRecurringCrew.mutateAsync({
        recurringJobId: jobAny.recurring_job_id,
        crewUserIds: pendingCrewUserIds,
      });
      toast.success("Default crew updated for future instances");
    } catch {
      toast.error("Failed to update default crew");
    } finally {
      setCrewSavePromptOpen(false);
      setPendingCrewUserIds([]);
    }
  };

  const openScheduleDialog = () => {
    setScheduleForm({
      scheduled_date: "",
      scheduled_time_start: "",
      scheduled_time_end: ""
    });
    setScheduleDialogOpen(true);
  };

  const handleSchedule = async () => {
    if (!id) return;
    const result = await scheduleJob({
      leadId: id,
      scheduledDate: scheduleForm.scheduled_date,
      startTime: scheduleForm.scheduled_time_start,
      endTime: scheduleForm.scheduled_time_end,
    });

    if (result.ok) {
      setScheduleForm({ scheduled_date: "", scheduled_time_start: "", scheduled_time_end: "" });
      setScheduleDialogOpen(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!id) return;

    try {
      await deleteSchedule.mutateAsync({
        id: scheduleId,
        lead_id: id,
      });
      toast.success("Schedule removed!");
    } catch (error) {
      console.error("Error removing schedule:", error);
      toast.error("Failed to remove schedule");
    }
  };

  const handleMakeUnique = async () => {
    if (!id) return;

    try {
      await makeUnique.mutateAsync(id);
      toast.success("Job detached from schedule");
      setMakeUniqueDialogOpen(false);
    } catch (error) {
      console.error("Error making job unique:", error);
      toast.error("Failed to detach job from schedule");
    }
  };

  const openEditDialog = () => {
    setEditForm({
      name: job?.name || "",
      service_type: job?.service_type || "",
      address: job?.address || "",
      description: job?.description || "",
      customer_name: job?.customer?.name || "",
      customer_phone: job?.customer?.phone || "",
      customer_email: job?.customer?.email || "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!id) return;

    try {
      if (job?.customer?.id) {
        await supabase
          .from("customers")
          .update({
            name: editForm.customer_name.trim(),
            phone: editForm.customer_phone.trim() || null,
            email: editForm.customer_email.trim() || null,
            address: editForm.address.trim() || null,
          })
          .eq("id", job.customer.id);
      }

      await updateJobMutation.mutateAsync({
        id,
        name: editForm.name.trim() || null,
        service_type: editForm.service_type || null,
        address: editForm.address.trim() || null,
        description: editForm.description.trim() || null,
      });

      toast.success("Job updated successfully!");
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error("Failed to update job");
    }
  };

  const openAddressDialog = () => {
    setAddressValue(job?.address || "");
    setAddressDialogOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!id) return;
    try {
      const trimmed = addressValue.trim() || null;
      await updateJobMutation.mutateAsync({ id, address: trimmed });
      if (job?.customer?.id) {
        await supabase
          .from("customers")
          .update({ address: trimmed })
          .eq("id", job.customer.id);
      }
      toast.success("Address updated!");
      setAddressDialogOpen(false);
    } catch {
      toast.error("Failed to update address");
    }
  };

  const deleteJob = async () => {
    if (!id) return;

    try {
      const jobAny = job as any;
      if (jobAny.recurring_job_id) {
        const { data: allJobs, error: fetchError } = await supabase
          .from("leads")
          .select("id")
          .eq("recurring_job_id", jobAny.recurring_job_id);

        if (fetchError) throw fetchError;

        if (allJobs && allJobs.length > 0) {
          const jobIds = allJobs.map((j) => j.id);

          const { error: assignmentsError } = await supabase
            .from("job_assignments")
            .delete()
            .in("lead_id", jobIds);

          if (assignmentsError) throw assignmentsError;

          const { error: schedulesError } = await supabase
            .from("job_schedules")
            .delete()
            .in("lead_id", jobIds);

          if (schedulesError) throw schedulesError;

          const { error: estimatesError } = await supabase
            .from("estimates")
            .delete()
            .in("job_id", jobIds);

          if (estimatesError) throw estimatesError;
        }

        const { error: masterEstimateError } = await supabase
          .from("estimates")
          .delete()
          .eq("recurring_job_id", jobAny.recurring_job_id);

        if (masterEstimateError) throw masterEstimateError;

        const { error: leadsError } = await supabase
          .from("leads")
          .delete()
          .eq("recurring_job_id", jobAny.recurring_job_id);

        if (leadsError) throw leadsError;

        const { error: recurError } = await supabase
          .from("recurring_jobs")
          .delete()
          .eq("id", jobAny.recurring_job_id);

        if (recurError) throw recurError;

        queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        toast.success("Job schedule and all associated jobs deleted successfully");
      } else {
        await deleteJobMutation.mutateAsync(id);
        toast.success("Job deleted successfully");
      }
      navigate("/jobs");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const statusLabelMap: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    "in-progress": "In Progress",
    completed: "Completed",
    paid: "Paid",
  };

  const displayStatus = (job as any).display_status || job.status;
  const statusLabel = statusLabelMap[displayStatus] || displayStatus;
  const isUnassigned = hasSchedules && jobAssignments.length === 0;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Job Details" showBack backTo="/jobs" />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
          <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={displayStatus as any} size="lg">
                {statusLabel}
              </StatusBadge>
              {jobAny.recurring_job_id && (
                <Badge variant="outline" className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700">
                  <Repeat className="h-3 w-3 mr-1" />
                  Visit #{jobAny.recurring_instance_number || ""}
                </Badge>
              )}
              {isUnassigned && (
                <Badge variant="outline" className="text-xs border-red-300 bg-red-50 text-red-700">
                  <Users className="h-3 w-3 mr-1" />
                  Unassigned
                </Badge>
              )}
              {isManager() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openEditDialog}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Job
                    </DropdownMenuItem>
                    {jobAny.recurring_job_id ? (
                      <DropdownMenuItem onClick={() => setRecurringDetailModalOpen(true)}>
                        <Repeat className="h-4 w-4 mr-2" />
                        View Schedule Details
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setMakeRecurringOpen(true)}>
                        <Repeat className="h-4 w-4 mr-2" />
                        Create Recurring Schedule
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {job.name || job.customer?.name || "Unknown Client"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {job.service_type || "No service type"}{job?.is_estimate_visit ? ", Estimate" : ""}
            </p>
            <button onClick={openAddressDialog} className="flex items-center gap-1 text-sm text-muted-foreground mt-1 hover:text-foreground transition-colors">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{clientAddress || "No address"}</span>
            </button>
          </div>
          <div className="text-right ml-4">
            <p className="text-2xl font-bold text-foreground">
              ${estimate?.total ? Number(estimate.total).toLocaleString() : (job.actual_value ? Number(job.actual_value).toLocaleString() : "0")}
            </p>
            <p className="text-xs text-muted-foreground">{jobAny.recurring_job_id ? "Quote Total" : "Estimate Total"}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleCall}
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleText}
          >
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleNavigate}
          >
            <Navigation className="h-4 w-4" />
            Navigate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {[
            { id: "details", label: "Details" },
            { id: "checklist", label: "Checklist" },
            { id: "photos", label: "Photos" },
            { id: "notes", label: "Notes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Next Step Guidance */}
      {job.status !== "paid" && isManager() && (
        <div className="px-4 pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              {(job as any).display_status === "unscheduled" && "Schedule this job to set a date and get the crew ready."}
              {(job as any).display_status === "scheduled" && "This job is scheduled. It will move to in-progress on the scheduled date."}
              {(job as any).display_status === "in_progress" && "This job is in progress. Mark it as complete once the work is done."}
              {(job as any).display_status === "completed" && "This job is complete. Record the payment to close it out."}
            </p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <main className="px-4 py-4 pb-32">
        {activeTab === "details" && (
          <div className="space-y-4">
            {/* Estimate / Quote */}
            {estimate ? (
              <button
                onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <DollarSign className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {jobAny.recurring_job_id ? `${job.customer?.name || ""} Quote` : "Estimate"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      ${Number(estimate.total).toLocaleString()} · {estimate.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.line_items?.length || 0} line items
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            ) : !estimateLoading ? (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <DollarSign className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {jobAny.recurring_job_id ? "Quote" : "Estimate"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {jobAny.recurring_job_id ? "No quote yet" : "No estimate yet"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Schedule or Job Schedule Info */}
            {!jobAny.recurring_job_id ? (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Clock className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Schedule</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {scheduledDatesText}
                    </p>
                  </div>
                </div>

                {schedulesLoading ? (
                  <div className="flex justify-center py-2">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : hasSchedules ? (
                  <div className="space-y-2 mb-3">
                    {schedules.map((schedule) => {
                      const outsideHours = isOutsideBusinessHours(
                        businessHours,
                        schedule.scheduled_date,
                        schedule.scheduled_time_start,
                        schedule.scheduled_time_end
                      );

                      return (
                        <div key={schedule.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {format(new Date(schedule.scheduled_date + "T00:00:00"), "EEE, MMM d, yyyy")}
                              </p>
                              {outsideHours && (
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-400">
                                  Outside normal hours
                                </Badge>
                              )}
                            </div>
                            {schedule.scheduled_time_start && schedule.scheduled_time_end && (
                              <p className="text-xs text-muted-foreground">
                                {schedule.scheduled_time_start} - {schedule.scheduled_time_end}
                              </p>
                            )}
                          </div>
                          {isManager() && (<Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>)}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {isManager() && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openScheduleDialog}
                      className="w-full gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Schedule Date
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMakeRecurringOpen(true)}
                      className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Repeat className="h-4 w-4" />
                      Create Recurring Schedule
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Crew Assignments */}
            {id && !jobAny.recurring_job_id && (
              <JobAssignments
                leadId={id}
              />
            )}

            {/* Crew info for recurring jobs */}
            {id && jobAny.recurring_job_id && (
              <JobAssignments
                leadId={id}
                onCrewChanged={() => {
                  setTimeout(async () => {
                    if (!id) return;
                    const { data: currentAssignments } = await supabase
                      .from("job_assignments")
                      .select("user_id")
                      .eq("lead_id", id);
                    const crewIds = [...new Set((currentAssignments || []).map((a: any) => a.user_id))];
                    setPendingCrewUserIds(crewIds);
                    setCrewSavePromptOpen(true);
                  }, 500);
                }}
              />
            )}

            {/* Crew */}
            {job.crew_lead && (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Crew Lead</p>
                    <p className="text-sm text-foreground mt-0.5">
                      {job.crew_lead?.full_name || "Assigned"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Description/Notes */}
            {(job.description || job.notes) && (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <FileText className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {job.description ? "Description" : "Notes"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.description || job.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Job Schedule Info */}
            {recurringJobData && (
              <button
                onClick={() => setRecurringDetailModalOpen(true)}
                className="card-elevated rounded-lg p-4 w-full text-left transition-all hover:shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Repeat className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Job Schedule</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {recurringJobData.frequency === "weekly" && "Every week"}
                      {recurringJobData.frequency === "biweekly" && "Every 2 weeks"}
                      {recurringJobData.frequency === "monthly" && "Every month"}
                      {recurringJobData.end_date
                        ? ` until ${format(new Date(recurringJobData.end_date + "T00:00:00"), "MMM d, yyyy")}`
                        : " (ongoing)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Visit #{jobAny.recurring_instance_number || ""}
                      {recurringJobData.is_active ? "" : " - Schedule paused"}
                    </p>
                  </div>
                  {isManager() && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditScheduleOpen(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setMakeUniqueDialogOpen(true);
                        }}>
                          <Unlink className="h-4 w-4 mr-2" />
                          Make Unique
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </button>
            )}

            {/* Client Share Link */}
            {isManager() && id && (
              jobAny.recurring_job_id ? (
                <ClientShareLink
                  recurringJobId={jobAny.recurring_job_id}
                  existingToken={recurringJobData?.client_share_token}
                />
              ) : (
                <ClientShareLink
                  jobId={job.is_estimate_visit && parentLeadId ? parentLeadId : id}
                  existingToken={job.is_estimate_visit ? parentLeadToken : jobAny.client_share_token}
                />
              )
            )}
          </div>
        )}

        {activeTab === "checklist" && id && (
          <JobChecklist
            jobId={id}
            isEstimateVisit={job?.is_estimate_visit}
            clientPortalUrl={
              (() => {
                const token = jobAny.recurring_job_id
                  ? recurringJobData?.client_share_token
                  : job?.is_estimate_visit ? parentLeadToken : jobAny.client_share_token;
                return token ? `${window.location.origin}/client/job?token=${token}` : null;
              })()
            }
            isManager={isManager()}
          />
        )}

        {activeTab === "photos" && id && (
          <div className="space-y-8">
            <PhotoSection
              leadId={job?.is_estimate_visit && parentLeadId ? parentLeadId : id}
              photoType="before"
              title="Before Photos"
              onJobConverted={handleJobConverted}
            />
            {!job?.is_estimate_visit && (
              <PhotoSection
                leadId={id}
                photoType="after"
                title="After Photos"
              />
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={addNote}
                disabled={addingNote || !newNote.trim()}
                className="self-end"
              >
                {addingNote ? "Adding..." : "Add"}
              </Button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="card-elevated rounded-lg p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.body || note.summary}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No notes yet</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Action */}
      {!job.is_estimate_visit && (hasAfterPhotos || job.status === "paid" || (job as any).display_status === "completed") && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <Button
            className="w-full h-14 text-base font-semibold"
            onClick={() => setCompleteDialogOpen(true)}
            disabled={job.status === "paid"}
          >
            {job.status === "paid" ? "Payment Received" : ((job as any).display_status === "completed" ? "Received Payment" : "Mark as Complete")}
          </Button>
        </div>
      )}

      {/* Payment/Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(job as any).display_status === "completed" ? "Record Payment" : "Mark Job as Complete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(job as any).display_status === "completed"
                ? "Have you received payment for this job? This will mark the job as paid."
                : "Are you sure you want to mark this job as complete? This will update the job status."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReceivedPayment}>
              {(job as any).display_status === "completed" ? "Confirm Payment" : "Mark Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule Date</DialogTitle>
            <DialogDescription>
              Add a new scheduled work date for this job. You can add multiple dates for multi-day projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Scheduled Date *</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleForm.scheduled_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-start-time">Start Time</Label>
                <Input
                  id="schedule-start-time"
                  type="time"
                  value={scheduleForm.scheduled_time_start}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end-time">End Time</Label>
                <Input
                  id="schedule-end-time"
                  type="time"
                  value={scheduleForm.scheduled_time_end}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time_end: e.target.value })}
                />
              </div>
            </div>
            {scheduleForm.scheduled_date && (
              <div className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">
                {hasSchedules
                  ? "Adding additional scheduled date. Job status will update automatically based on all scheduled dates."
                  : "Job status will update automatically based on scheduled dates."}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} disabled={!scheduleForm.scheduled_date}>
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Job Location</DialogTitle>
            <DialogDescription>Update the address for this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="job-address">Address</Label>
            <Input
              id="job-address"
              value={addressValue}
              onChange={(e) => setAddressValue(e.target.value)}
              placeholder="Enter job address"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAddress}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Details</DialogTitle>
            <DialogDescription>
              Update job and customer information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Customer Info</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-name">Customer Name</Label>
                <Input
                  id="edit-customer-name"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-phone">Phone</Label>
                  <Input
                    id="edit-customer-phone"
                    type="tel"
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-email">Email</Label>
                  <Input
                    id="edit-customer-email"
                    type="email"
                    value={editForm.customer_email}
                    onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                    placeholder="john@email.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Job Details</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Job Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Smith Patio Project"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-service-type">Service Type</Label>
                <Select
                  value={editForm.service_type}
                  onValueChange={(v) => setEditForm({ ...editForm, service_type: v })}
                >
                  <SelectTrigger id="edit-service-type">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pavers / Patio">Pavers / Patio</SelectItem>
                    <SelectItem value="Concrete">Concrete</SelectItem>
                    <SelectItem value="Sod / Lawn">Sod / Lawn</SelectItem>
                    <SelectItem value="Deck">Deck</SelectItem>
                    <SelectItem value="Fencing">Fencing</SelectItem>
                    <SelectItem value="Retaining Wall">Retaining Wall</SelectItem>
                    <SelectItem value="Landscaping">Landscaping</SelectItem>
                    <SelectItem value="Hardscaping">Hardscaping</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Job Address</Label>
                <Input
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="123 Main St, Austin, TX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Project scope and details..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {jobAny?.recurring_job_id ? "Delete Job Schedule" : "Delete Job"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {jobAny?.recurring_job_id
                ? "Are you sure you want to delete this job schedule? This will permanently delete all jobs associated with this schedule. This action cannot be undone."
                : "Are you sure you want to delete this job? This action cannot be undone and will remove all associated data including the estimate."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteJobMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteJob}
              disabled={deleteJobMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteJobMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crew Save for Future Prompt */}
      <AlertDialog open={crewSavePromptOpen} onOpenChange={setCrewSavePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Default Crew?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed the crew on this recurring job instance. Would you like to save this crew as the default for all future instances?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCrewSavePromptOpen(false); setPendingCrewUserIds([]); }}>
              No, just this one
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveCrewForFuture}>
              Yes, save for future
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Make Recurring Dialog */}
      {id && (
        <MakeRecurringDialog
          open={makeRecurringOpen}
          onOpenChange={setMakeRecurringOpen}
          jobId={id}
          jobSchedules={schedules}
        />
      )}

      {/* Edit Job Schedule Dialog */}
      {jobAny.recurring_job_id && (
        <EditJobScheduleDialog
          open={editScheduleOpen}
          onOpenChange={setEditScheduleOpen}
          recurringJobId={jobAny.recurring_job_id}
          recurringJobData={recurringJobData}
        />
      )}

      {/* Recurring Job Detail Modal */}
      {jobAny.recurring_job_id && id && (
        <RecurringJobDetailModal
          open={recurringDetailModalOpen}
          onOpenChange={setRecurringDetailModalOpen}
          recurringJobId={jobAny.recurring_job_id}
          jobId={id}
          onEdit={() => {
            setRecurringDetailModalOpen(false);
            setEditScheduleOpen(true);
          }}
          onDelete={() => {
            setDeleteDialogOpen(true);
          }}
          onMadeUnique={() => {
            window.location.reload();
          }}
        />
      )}

      {/* Make Unique Alert Dialog */}
      <AlertDialog open={makeUniqueDialogOpen} onOpenChange={setMakeUniqueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make Job Unique</AlertDialogTitle>
            <AlertDialogDescription>
              This will detach this job from the recurring schedule, allowing you to modify its
              dates and details independently. The current date will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMakeUnique} disabled={makeUnique.isPending}>
              {makeUnique.isPending ? "Processing..." : "Make Unique"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
