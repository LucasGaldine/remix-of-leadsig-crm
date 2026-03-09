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
  Archive,
  MoreVertical,
  Plus,
  Info,
  Unlink,
  Briefcase,
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
import { openMapsWithAddress } from "@/lib/openMaps";
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
import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";
import { JobInvoiceCard } from "@/components/jobs/JobInvoiceCard";
import { JobTimeTracker } from "@/components/jobs/JobTimeTracker";
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
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressValue, setAddressValue] = useState("");
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
  const [hasBeforePhotos, setHasBeforePhotos] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; body: string | null; summary: string | null; created_at: string; created_by: string | null }>>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEstimate();
      fetchParentLead();
      fetchAfterPhotos();
      fetchBeforePhotos();
      fetchNotes();
    }
  }, [id, parentLeadId]);

  useEffect(() => {
    const jobAny = job as any;
    if (jobAny?.recurring_job_id && (jobAny.status === "completed" || jobAny.status === "paid")) {
      generateNextInstances.mutate(jobAny.recurring_job_id);
    }
  }, [job?.status, (job as any)?.recurring_job_id]);

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

  const fetchBeforePhotos = async () => {
    if (!id) return;
    try {
      const photoLeadId = job?.is_estimate_visit && parentLeadId ? parentLeadId : id;
      const { count } = await supabase
        .from("lead_photos")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", photoLeadId)
        .eq("photo_type", "before");
      setHasBeforePhotos((count ?? 0) > 0);
    } catch (error) {
      console.error("Error fetching before photos:", error);
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
      openMapsWithAddress(clientAddress);
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
    setScheduleDialogOpen(true);
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
      window.location.reload();
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

          const { data: jobEstimates } = await supabase
            .from("estimates")
            .select("id")
            .in("job_id", jobIds);

          if (jobEstimates && jobEstimates.length > 0) {
            const estIds = jobEstimates.map((e) => e.id);
            await supabase
              .from("estimate_line_items")
              .delete()
              .in("estimate_id", estIds);

            const { error: estimatesError } = await supabase
              .from("estimates")
              .delete()
              .in("id", estIds);

            if (estimatesError) throw estimatesError;
          }
        }

        const { data: masterEstimates } = await supabase
          .from("estimates")
          .select("id")
          .eq("recurring_job_id", jobAny.recurring_job_id);

        if (masterEstimates && masterEstimates.length > 0) {
          const estimateIds = masterEstimates.map((e) => e.id);

          await supabase
            .from("estimate_line_items")
            .delete()
            .in("estimate_id", estimateIds);

          const { error: masterEstimateError } = await supabase
            .from("estimates")
            .delete()
            .in("id", estimateIds);

          if (masterEstimateError) throw masterEstimateError;
        }

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
        queryClient.invalidateQueries({ queryKey: ["projected-recurring-dates"] });
        queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
        toast.success("Job schedule and all associated jobs deleted successfully");
      } else {
        await deleteJobMutation.mutateAsync(id);
        toast.success("Job deleted successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["projected-recurring-dates"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      navigate("/jobs");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const archiveJob = async () => {
    if (!id || !job) return;
    const isCompleted = job.status === "completed" || job.status === "paid";
    const newStatus = isCompleted ? "archived" : "lost";

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
      queryClient.invalidateQueries({ queryKey: ["archived-leads"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.success(isCompleted ? "Job archived" : "Job marked as lost");
      navigate("/jobs");
    } catch (error) {
      console.error("Error archiving:", error);
      toast.error("Failed to archive");
    } finally {
      setArchiveDialogOpen(false);
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
    <div className="min-h-screen  bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/jobs" />

      {/* Status Banner */}
      <div className="max-w-[var(--content-max-width)] m-auto p-4 pb-0">
        <div className="bg-card rounded-lg border border-border">

          {/* Main Content */}
          <div className="flex flex-col pt-8 pb-8 p-4 gap-4">

            <div className="flex flex-col sm:flex-row gap-4">
              {/*Left Column */}
              <div className="flex flex-col flex-1 min-w-0 gap-2">
                
                <div className="flex items-center gap-2">
                <p className="text-1">
                  {job.name || job.customer?.name || "Unknown Client"}
                </p>

                {isManager() && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
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
                        <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)}>
                          <Archive className="h-4 w-4 mr-2" />
                          {job?.status === "completed" || job?.status === "paid" ? "Archive" : "Mark as Lost"}
                        </DropdownMenuItem>
                        {jobAny.recurring_job_id && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Job Schedule
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                <div className="text-5">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 shrink-0"></Briefcase>
                  <p >
                    {job.service_type || "No service type"}{job?.is_estimate_visit ? ", Estimate" : ""}
                  </p>
                  </div>
                  <button onClick={openAddressDialog} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{clientAddress || "No address"}</span>
                  </button>
                </div>
              </div>
              
              {/*Right Column */}
              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex justify-end gap-2">
                  
                  
                  {isUnassigned && (
                    <Badge variant="outline" className="text-xs border-red-300 bg-red-50 text-red-700">
                      <Users className="h-3 w-3 mr-1" />
                      Unassigned
                    </Badge>
                  )}

                  {jobAny.recurring_job_id && (
                    <Badge variant="outline" className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700">
                      <Repeat className="h-3 w-3 mr-1" />
                      Visit #{jobAny.recurring_instance_number || ""}
                    </Badge>
                  )}

                  <StatusBadge status={displayStatus as any} size="lg">
                    {statusLabel}
                  </StatusBadge>

                </div>
                
                <div className="text-right text-muted-foreground">
                  <p className="text-2 ">
                  ${estimate?.total ? Number(estimate.total).toLocaleString() : (job.actual_value ? Number(job.actual_value).toLocaleString() : "0")}
                  </p>
                  <p className="text-xs ">{jobAny.recurring_job_id ? "Quote Total" : "Estimate Total"}</p>
                </div>

              </div>

            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs px-2"
                onClick={handleCall}
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline">Call</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs px-2"
                onClick={handleText}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline">Text</span>
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs px-2"
                onClick={handleNavigate}
              >
                <Navigation className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline">Navigate</span>
              </Button>
            </div>
          </div>


          {/* Tabs */}
          <div className="max-w-[var(--content-max-width)] border-t ml-auto mr-auto px-4 ">
            <div className="flex">
              {[
                { id: "details", label: "Details" },
                { id: "checklist", label: "Checklist" },
                { id: "photos", label: "Photos" },
                { id: "notes", label: "Notes" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as typeof activeTab);
                    if (tab.id === "checklist") {
                      fetchBeforePhotos();
                    }
                  }}
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



        </div>
      </div>

      


      {/* Tab Content */}

        {activeTab === "details" && (
          <div className="p-4 flex flex-col justify-center max-w-[var(--content-max-width)] m-auto gap-4">
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

            {/* Invoices */}
            {id && (
              <JobInvoiceCard
                jobId={id}
                customerEmail={job.customer?.email}
                customerName={job.customer?.name}
              />
            )}


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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setMakeRecurringOpen(true)}
                    >
                      <Repeat className="h-4 w-4 shrink-0" />
                      Recurring
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={openScheduleDialog}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      Add Date
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
          <div className="p-4 flex flex-col justify-center max-w-[var(--content-max-width)] m-auto gap-4"> 
          <JobTimeTracker
            jobId={id}
            jobAddress={clientAddress || null}
            accountId={currentAccount?.id}
          />
          <JobChecklist
            jobId={id}
            jobStatus={job?.status}
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
            hasBeforePhotos={hasBeforePhotos}
            onMarkComplete={async () => {
              await updateJobMutation.mutateAsync({ id, status: "completed" as any });
              
              // If this is an estimate visit, create a new regular job from this estimate visit's data
              if (job?.is_estimate_visit) {
                try {
                  // Re-fetch the current job to get latest data
                  const { data: currentJob } = await supabase
                    .from("leads")
                    .select("*")
                    .eq("id", id)
                    .single();

                  if (currentJob) {
                    const { data: newJob, error: insertError } = await supabase
                      .from("leads")
                      .insert({
                        name: currentJob.name,
                        address: currentJob.address,
                        city: currentJob.city,
                        state: currentJob.state,
                        service_type: currentJob.service_type,
                        description: currentJob.description,
                        customer_id: currentJob.customer_id,
                        account_id: currentJob.account_id,
                        created_by: currentJob.created_by,
                        estimated_value: currentJob.estimated_value,
                        source: currentJob.source,
                        status: "job",
                        approval_status: "approved",
                        is_estimate_visit: false,
                        estimate_job_id: id,
                      })
                      .select()
                      .single();

                    if (insertError) throw insertError;

                    queryClient.invalidateQueries({ queryKey: ["jobs"] });
                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                    toast.success("New job created from estimate visit!");
                    
                    if (newJob) {
                      navigate(`/jobs/${newJob.id}`);
                    }
                  }
                } catch (error) {
                  console.error("Error creating job from estimate visit:", error);
                  toast.error("Failed to auto-create job from estimate visit");
                }
              }
            }}
          />
          </div>
        )}

        {activeTab === "photos" && id && (
          <div className="p-4 flex flex-col justify-center max-w-[var(--content-max-width)] m-auto gap-4">
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
          <div className="p-4 flex flex-col justify-center max-w-[var(--content-max-width)] m-auto gap-4">
            <div className="card-elevated rounded-lg p-4">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={addNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Note
                </Button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-3 flex flex-col gap-4">
                {notes.map((note) => (

                  <div key={note.id} className="card-elevated flex gap-4 rounded-lg p-4">

                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>

                    <div className="flex-1 items-center justify-between gap-2 mb-0.5">
                    <p className="text-3">{note.body || note.summary}</p>

                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    </div>
                  </div>

                  
                ))}
              </div>
            ) : (
              null
            )}
          </div>
        )}


{/* */}


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
      {id && (
        <ScheduleJobDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          jobId={id}
          jobName={job?.name || undefined}
          hasSchedules={hasSchedules}
          onMakeRecurring={!jobAny.recurring_job_id ? () => setMakeRecurringOpen(true) : undefined}
        />
      )}

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

      {/* Archive / Mark as Lost Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {job?.status === "completed" || job?.status === "paid" ? "Archive Job" : "Mark as Lost"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {job?.status === "completed" || job?.status === "paid"
                ? `This will archive "${job?.name || "this job"}" and send it to the archive. You can restore it later from the Archive section on the Leads page.`
                : `This will mark "${job?.name || "this job"}" as lost and send it to the archive. You can restore it later from the Archive section on the Leads page.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={archiveJob}>
              {job?.status === "completed" || job?.status === "paid" ? "Archive" : "Mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Recurring Schedule Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job schedule? This will permanently delete all jobs associated with this schedule. This action cannot be undone.
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
