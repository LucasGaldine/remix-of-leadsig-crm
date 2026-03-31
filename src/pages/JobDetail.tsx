import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapPin, User, Phone, MessageSquare, EllipsisVertical, SquareCheck as CheckSquare, FileText, DollarSign, Calendar, Clock, Pencil as Edit, Trash2, Archive, MoveVertical as MoreVertical, Plus, Info, Unlink, Briefcase, Navigation, ChevronDown, Mail, Share2, AlertTriangle, Copy, Check } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { openMapsWithAddress } from "@/lib/openMaps";
import { useJob, useUpdateJob, useDeleteJob, useMakeJobUnique } from "@/hooks/useJobs";
import { useJobSchedules } from "@/hooks/useJobSchedules";
import { useAuth } from "@/hooks/useAuth";
import { useJobAssignments } from "@/hooks/useJobAssignments";
import { useJobChecklist } from "@/hooks/useJobChecklist";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { isOutsideBusinessHours } from "@/lib/businessHours";
import { Badge } from "@/components/ui/badge";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { PhotoSection } from "@/components/photos/PhotoSection";
import { JobChecklist } from "@/components/jobs/JobChecklist";
import { useRecurringJob, useGenerateNextInstances, useUpdateRecurringJobCrew, useRecurringJobEstimate } from "@/hooks/useRecurringJobs";
import { MakeRecurringDialog } from "@/components/jobs/MakeRecurringDialog";
import { EditJobScheduleDialog } from "@/components/jobs/EditJobScheduleDialog";
import { RecurringJobDetailModal } from "@/components/jobs/RecurringJobDetailModal";
import { ScheduleJobDialog } from "@/components/jobs/ScheduleJobDialog";
import { JobInvoiceCard } from "@/components/jobs/JobInvoiceCard";
import { JobTimeTracker } from "@/components/jobs/JobTimeTracker";
import { Repeat } from "lucide-react";
import { JobCosts } from "@/components/jobs/JobCosts";
import { LineItemsEstimateDialog } from "@/components/leads/LineItemsEstimateDialog";
import { MentionInput } from "@/components/ui/mention-input";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { extractMentions, parseMentionsForDisplay } from "@/lib/mentionParser";
import { getDetailDeleteConfig } from "@/lib/detailDeleteConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DetailEstimateCard } from "@/components/shared/DetailEstimateCard";
import { Separator } from "@/components/ui/separator";
import { SERVICE_TYPES } from "@/constants/serviceTypes";

const JOB_STATUS_GUIDANCE = [
  {
    value: "unscheduled",
    label: "Unscheduled",
    description: "The job exists, but no visit date has been added yet.",
    requirement: "Create the job and leave it without any scheduled dates.",
  },
  {
    value: "unassigned",
    label: "Unassigned",
    description: "The job has a scheduled visit, but nobody has been assigned to work it yet.",
    requirement: "Add a date to the job schedule, then leave the crew assignment empty.",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "The job is on the calendar and has crew assigned for the visit.",
    requirement: "Schedule the job and assign the right crew members to it.",
  },
  {
    value: "completed",
    label: "Completed",
    description: "The field work is finished and the job is ready for billing or closeout.",
    requirement: "Mark the job complete after the work has been done.",
  },
  {
    value: "needs_invoice",
    label: "Needs Invoice",
    description: "The job is completed, but there is not an invoice created for it yet.",
    requirement: "Complete the job without creating or sending an invoice yet.",
  },
  {
    value: "paid",
    label: "Paid",
    description: "The invoice has been paid and the job is fully closed out.",
    requirement: "Create the invoice for the completed job and record the payment.",
  },
] as const;

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
  });

  const queryClient = useQueryClient();
  const { data: job, isLoading, error } = useJob(id);
  const { data: schedules = [], isLoading: schedulesLoading } = useJobSchedules(id);
  const { businessHours } = useBusinessHours();
  const { scheduleJob, deleteSchedule, isScheduling } = useScheduleJob();
  const { assignments: jobAssignments = [] } = useJobAssignments(id);
  const { items: checklistItems = [] } = useJobChecklist(id);
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();
  const { data: recurringJobData } = useRecurringJob((job as any)?.recurring_job_id ?? undefined);
  const { data: recurringJobEstimate } = useRecurringJobEstimate((job as any)?.recurring_job_id ?? undefined);
  const generateNextInstances = useGenerateNextInstances();
  const updateRecurringCrew = useUpdateRecurringJobCrew();
  const [crewSavePromptOpen, setCrewSavePromptOpen] = useState(false);
  const [pendingCrewUserIds, setPendingCrewUserIds] = useState<string[]>([]);
  const [editCrewDialogOpen, setEditCrewDialogOpen] = useState(false);
  const [editingCrewScheduleId, setEditingCrewScheduleId] = useState<string | null>(null);
  const [editingCrewUserIds, setEditingCrewUserIds] = useState<string[]>([]);
  const [editingScheduleDate, setEditingScheduleDate] = useState("");
  const [editingScheduleTimeStart, setEditingScheduleTimeStart] = useState("");
  const [editingScheduleTimeEnd, setEditingScheduleTimeEnd] = useState("");
  const [editingSuppressUnassigned, setEditingSuppressUnassigned] = useState(false);
  const [editScheduleDeleteConfirmOpen, setEditScheduleDeleteConfirmOpen] = useState(false);
  const [savingCrewAssignments, setSavingCrewAssignments] = useState(false);
  const [makeRecurringOpen, setMakeRecurringOpen] = useState(false);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [recurringDetailModalOpen, setRecurringDetailModalOpen] = useState(false);
  const [makeUniqueDialogOpen, setMakeUniqueDialogOpen] = useState(false);
  const [statusGuidanceOpen, setStatusGuidanceOpen] = useState(false);

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
  const { data: teamMembers = [] } = useTeamMembers();
  const [hasInvoice, setHasInvoice] = useState(false);
  const [lineItemsEstimateDialogOpen, setLineItemsEstimateDialogOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalLink, setPortalLink] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const [headerInfoOpen, setHeaderInfoOpen] = useState(false);

  const isAutoGeneratedPlaceholderEstimate = (value: any) =>
    !!value &&
    value.status === "draft" &&
    Number(value.total || 0) === 0 &&
    (value.line_items?.length || 0) === 0 &&
    typeof value.notes === "string" &&
    value.notes.startsWith("Auto-generated estimate for ");

  const displayEstimate = isAutoGeneratedPlaceholderEstimate(estimate) ? null : estimate;

  const formatScheduleTimeLabel = (time?: string | null) => {
    if (!time) return null;
    const normalizedTime = time.length === 5 ? `${time}:00` : time;
    const parsedTime = new Date(`2000-01-01T${normalizedTime}`);
    if (Number.isNaN(parsedTime.getTime())) {
      return time;
    }
    return format(parsedTime, "h:mm a");
  };

  const formatScheduleTimeRange = (startTime?: string | null, endTime?: string | null) => {
    const formattedStart = formatScheduleTimeLabel(startTime);
    const formattedEnd = formatScheduleTimeLabel(endTime);

    if (formattedStart && formattedEnd) {
      return `${formattedStart} - ${formattedEnd}`;
    }

    return formattedStart || formattedEnd;
  };

  useEffect(() => {
    if (id) {
      fetchEstimate();
      fetchParentLead();
      fetchAfterPhotos();
      fetchBeforePhotos();
      fetchNotes();
      checkHasInvoice();
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
    fetchAfterPhotos();
    fetchBeforePhotos();
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

  const checkHasInvoice = async () => {
    if (!id) return;
    try {
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", id);
      setHasInvoice((count ?? 0) > 0);
    } catch (error) {
      console.error("Error checking for invoices:", error);
    }
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
      const latestOnly = <T,>(query: T): T => {
        const candidate = query as T & { order?: (column: string, opts: { ascending: boolean }) => any; limit?: (count: number) => any };
        if (typeof candidate.order === "function") {
          const ordered = candidate.order("created_at", { ascending: false });
          if (ordered && typeof ordered.limit === "function") {
            return ordered.limit(1) as T;
          }
          return ordered as T;
        }
        return query;
      };

      const { data: currentJob } = await supabase
        .from("leads")
        .select("recurring_job_id")
        .eq("id", id)
        .maybeSingle();

      if (currentJob?.recurring_job_id) {
        const recurringEstimateQuery = supabase
          .from("estimates")
          .select("id, total, status, notes, line_items:estimate_line_items(id)")
          .eq("recurring_job_id", currentJob.recurring_job_id);

        const { data: masterQuote, error: quoteError } = await latestOnly(recurringEstimateQuery)
          .maybeSingle();

        if (quoteError) throw quoteError;
        setEstimate(masterQuote);
        setEstimateLoading(false);
        return;
      }

      const estimateQuery = supabase
        .from("estimates")
        .select("id, total, status, notes, line_items:estimate_line_items(id)")
        .eq("job_id", id);

      let { data, error } = await latestOnly(estimateQuery)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: parentLead } = await supabase
          .from("leads")
          .select("id")
          .eq("estimate_job_id", id)
          .maybeSingle();

        if (parentLead) {
          const parentEstimateQuery = supabase
            .from("estimates")
            .select("id, total, status, notes, line_items:estimate_line_items(id)")
            .eq("job_id", parentLead.id);

          const { data: parentEstimate, error: parentError } = await latestOnly(parentEstimateQuery)
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
  const jobDescription = (job.description || job.notes || "").trim();
  const hasSchedules = schedules && schedules.length > 0;

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

  const handleEstimateSuccess = async () => {
    await fetchEstimate();
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
  };

  const openBuildEstimateModal = async () => {
    if (!isAutoGeneratedPlaceholderEstimate(estimate)) {
      setLineItemsEstimateDialogOpen(true);
      return;
    }

    if (!estimate?.id) {
      setLineItemsEstimateDialogOpen(true);
      return;
    }

    const { error } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id);

    if (error) {
      toast.error("Failed to prepare estimate builder. Please try again.");
      return;
    }

    setEstimate(null);
    setLineItemsEstimateDialogOpen(true);
  };

  const resolveCustomerPortalLink = async () => {
    const customerId = job?.customer?.id;
    if (!customerId) {
      throw new Error("No customer linked to this job");
    }

    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("client_portal_token")
      .eq("id", customerId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let token = customer?.client_portal_token || null;
    if (!token) {
      token = crypto.randomUUID();
      const { error: updateError } = await supabase
        .from("customers")
        .update({ client_portal_token: token })
        .eq("id", customerId);

      if (updateError) throw updateError;
    }

    return `${window.location.origin}/client/job?token=${token}`;
  };

  const handleOpenClientPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const link = await resolveCustomerPortalLink();
      setPortalLink(link);
      setPortalDialogOpen(true);
    } catch (err) {
      toast.error("Failed to generate portal link");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyPortalLink = async () => {
    if (!portalLink) return;
    try {
      await navigator.clipboard.writeText(portalLink);
      setPortalCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setPortalCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
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

  const getScheduleAssignments = (scheduleId: string) => {
    return jobAssignments.filter((assignment) => assignment.job_schedule_id === scheduleId);
  };

  const openEditCrewDialog = (scheduleId: string) => {
    const schedule = schedules.find((item) => item.id === scheduleId);
    const assignedUserIds = getScheduleAssignments(scheduleId).map((assignment) => assignment.user_id);
    setEditingCrewScheduleId(scheduleId);
    setEditingCrewUserIds([...new Set(assignedUserIds)]);
    setEditingScheduleDate(schedule?.scheduled_date || "");
    setEditingScheduleTimeStart(schedule?.scheduled_time_start || "");
    setEditingScheduleTimeEnd(schedule?.scheduled_time_end || "");
    setEditingSuppressUnassigned(Boolean(schedule?.suppress_unassigned));
    setEditCrewDialogOpen(true);
  };

  const toggleEditingCrewUser = (userId: string) => {
    setEditingCrewUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const handleSaveCrewAssignments = async () => {
    if (!id || !editingCrewScheduleId || !currentAccount || !user) {
      toast.error("Missing data to update crew assignments");
      return;
    }
    if (!editingScheduleDate) {
      toast.error("Date is required");
      return;
    }
    if (
      (editingScheduleTimeStart && !editingScheduleTimeEnd) ||
      (!editingScheduleTimeStart && editingScheduleTimeEnd)
    ) {
      toast.error("Set both start and end time");
      return;
    }
    if (editingScheduleTimeStart && editingScheduleTimeEnd && editingScheduleTimeEnd <= editingScheduleTimeStart) {
      toast.error("End time must be after start time");
      return;
    }

    const currentSchedule = schedules.find((schedule) => schedule.id === editingCrewScheduleId);
    if (!currentSchedule) {
      toast.error("Unable to find scheduled date");
      return;
    }

    const currentAssignments = getScheduleAssignments(editingCrewScheduleId);
    const currentUserIds = [...new Set(currentAssignments.map((assignment) => assignment.user_id))];
    const usersToAdd = editingCrewUserIds.filter((userId) => !currentUserIds.includes(userId));
    const assignmentIdsToRemove = currentAssignments
      .filter((assignment) => !editingCrewUserIds.includes(assignment.user_id))
      .map((assignment) => assignment.id);
    const crewChanged = usersToAdd.length > 0 || assignmentIdsToRemove.length > 0;
    const currentTimeStart = currentSchedule.scheduled_time_start || "";
    const currentTimeEnd = currentSchedule.scheduled_time_end || "";
    const currentSuppressUnassigned = Boolean(currentSchedule.suppress_unassigned);
    const scheduleChanged =
      editingScheduleDate !== currentSchedule.scheduled_date ||
      editingScheduleTimeStart !== currentTimeStart ||
      editingScheduleTimeEnd !== currentTimeEnd ||
      editingSuppressUnassigned !== currentSuppressUnassigned;

    if (!crewChanged && !scheduleChanged) {
      setEditCrewDialogOpen(false);
      return;
    }

    setSavingCrewAssignments(true);
    try {
      if (scheduleChanged) {
        const { error: scheduleError } = await supabase
          .from("job_schedules")
          .update({
            scheduled_date: editingScheduleDate,
            scheduled_time_start: editingScheduleTimeStart || null,
            scheduled_time_end: editingScheduleTimeEnd || null,
            suppress_unassigned: editingSuppressUnassigned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCrewScheduleId);

        if (scheduleError) throw scheduleError;
      }

      for (const userId of usersToAdd) {
        const { data: hasOverlap, error: overlapError } = await supabase.rpc("check_assignment_overlap", {
          p_user_id: userId,
          p_schedule_id: editingCrewScheduleId,
          p_account_id: currentAccount.id,
        });

        if (overlapError) throw overlapError;
        if (hasOverlap) {
          const crewName = teamMembers.find((member) => member.user_id === userId)?.full_name || "This crew member";
          toast.error(`${crewName} is already assigned to another job at this time.`);
          return;
        }
      }

      if (assignmentIdsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("job_assignments")
          .delete()
          .in("id", assignmentIdsToRemove);

        if (removeError) throw removeError;
      }

      if (usersToAdd.length > 0) {
        const { error: addError } = await supabase
          .from("job_assignments")
          .insert(
            usersToAdd.map((userId) => ({
              lead_id: id,
              user_id: userId,
              job_schedule_id: editingCrewScheduleId,
              account_id: currentAccount.id,
              assigned_by: user.id,
            })),
          );

        if (addError) throw addError;
      }

      queryClient.invalidateQueries({ queryKey: ["job-assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["job-schedules", id] });
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["crew-hours"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });

      if (jobAny.recurring_job_id && crewChanged) {
        setPendingCrewUserIds(editingCrewUserIds);
        setCrewSavePromptOpen(true);
      }

      if (crewChanged && scheduleChanged) {
        toast.success("Schedule and crew updated");
      } else if (scheduleChanged) {
        toast.success("Schedule updated");
      } else {
        toast.success("Crew assignments updated");
      }
      setEditCrewDialogOpen(false);
    } catch (error) {
      console.error("Error updating crew assignments:", error);
      toast.error("Failed to update crew assignments");
    } finally {
      setSavingCrewAssignments(false);
    }
  };


  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!id) return false;

    try {
      await deleteSchedule.mutateAsync({
        id: scheduleId,
        lead_id: id,
      });
      toast.success("Schedule removed!");
      return true;
    } catch (error) {
      console.error("Error removing schedule:", error);
      toast.error("Failed to remove schedule");
      return false;
    }
  };

  const handleDeleteEditedSchedule = async () => {
    if (!editingCrewScheduleId) return;
    const deleted = await handleDeleteSchedule(editingCrewScheduleId);
    setEditScheduleDeleteConfirmOpen(false);
    if (deleted) {
      setEditCrewDialogOpen(false);
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
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!id) return;

    try {
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
        toast.success(deleteJobConfig.successMessage);
      } else {
        await deleteJobMutation.mutateAsync(id);
        toast.success(deleteJobConfig.successMessage);
      }
      queryClient.invalidateQueries({ queryKey: ["projected-recurring-dates"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      navigate(deleteJobConfig.redirectPath);
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

  const getJobStatusBadgeStatus = (status: string) => {
    switch (status) {
      case "unscheduled":
        return "unscheduled";
      case "unassigned":
      case "needs_invoice":
        return "attention";
      case "scheduled":
        return "scheduled";
      case "in_progress":
      case "in-progress":
        return "in_progress";
      case "completed":
      case "paid":
        return "completed";
      case "job":
        return "job";
      default:
        return "pending";
    }
  };

  const displayStatus = (job as any).display_status || job.status;
  const statusLabel = statusLabelMap[displayStatus] || displayStatus;
  const assignedScheduleIds = new Set(
    jobAssignments
      .map((assignment) => assignment.job_schedule_id)
      .filter((scheduleId): scheduleId is string => Boolean(scheduleId)),
  );
  const remainingChecklistCount = checklistItems.filter((item) => !item.is_completed).length;
  const hasScheduleScopedAssignments = jobAssignments.some((assignment) => Boolean(assignment.job_schedule_id));
  const isUnassigned = schedules.length === 0
    ? jobAssignments.length === 0
    : hasScheduleScopedAssignments
      ? schedules.some((schedule) => !schedule.suppress_unassigned && !assignedScheduleIds.has(schedule.id))
      : schedules.some((schedule) => !schedule.suppress_unassigned) && jobAssignments.length === 0;
  const deleteJobConfig = getDetailDeleteConfig({
    entity: "job",
    name: job.name || "this job",
    isRecurring: !!jobAny.recurring_job_id,
  });

  return (
    <div className="min-h-screen  bg-surface-sunken pb-24">
      <PageHeader showBack backTo="/jobs" />

      {/* Header */}
      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 md:pt-8 pb-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2">
              {isUnassigned && (
                <Badge
                  variant="outline"
                  className="text-xs border-[hsl(var(--status-attention))]/40 bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unassigned
                </Badge>
              )}
              {job.status === "completed" && !hasInvoice && (
                <Badge
                  variant="outline"
                  className="text-xs border-[hsl(var(--status-attention))]/40 bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs Invoice
                </Badge>
              )}
              {jobAny.recurring_job_id && (
                <Badge variant="outline" className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700">
                  <Repeat className="h-3 w-3 mr-1" />
                  Visit #{jobAny.recurring_instance_number || ""}
                </Badge>
              )}
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setStatusGuidanceOpen(true)}
                  aria-label={`Open job status guide for ${statusLabel.toLowerCase()}`}
                >
                  <StatusBadge status={getJobStatusBadgeStatus(displayStatus) as any} >
                    {statusLabel}
                  </StatusBadge>
                </button>
                {remainingChecklistCount > 0 && (
                  <p className="pl-1 text-xs text-muted-foreground">
                    {remainingChecklistCount} checklist {remainingChecklistCount === 1 ? "task" : "tasks"} left
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-1 break-words">{job.name || "Job"}</p>
                {isManager() && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <EllipsisVertical className="h-4 w-4" />
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
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteJobConfig.menuLabel}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <p
              data-testid="job-description-preview"
              className={cn(
                "text-sm text-muted-foreground whitespace-pre-wrap",
                !headerInfoOpen && "line-clamp-3",
              )}
            >
              {jobDescription || "No description provided."}
            </p>

            <Collapsible
              open={headerInfoOpen}
              onOpenChange={setHeaderInfoOpen}
              data-testid="job-header-actions-row"
              className={cn(
                "flex w-full items-center gap-2",
                headerInfoOpen ? "flex-wrap" : "flex-nowrap md:justify-between",
              )}
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="group h-auto w-auto px-0 py-0 hover:bg-transparent text-muted-foreground order-1"
                >
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    More info
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </span>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="order-2 w-full space-y-2 pt-2">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-start gap-1">
                    <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {job.customer?.id ? (
                      <Link
                        to={`/customers/${job.customer.id}`}
                        className="break-words min-w-0 hover:text-foreground hover:underline transition-colors"
                      >
                        {job.customer?.name || "Unknown Client"}
                      </Link>
                    ) : (
                      <span className="break-words min-w-0">{job.customer?.name || "Unknown Client"}</span>
                    )}
                  </p>
                  <div className="flex items-start gap-1">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p className="break-words min-w-0">
                      {job.service_type || "No service type"}{job?.is_estimate_visit ? ", Estimate" : ""}
                    </p>
                  </div>
                  <button onClick={openAddressDialog} className="flex items-start gap-1 hover:text-foreground transition-colors text-left">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0">{clientAddress || "No address"}</span>
                  </button>
                  {(job.customer as any)?.phone && (
                    <p className="flex items-start gap-1">
                      <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="break-words min-w-0">{(job.customer as any).phone}</span>
                    </p>
                  )}
                  {(job.customer as any)?.email && (
                    <p className="flex items-start gap-1">
                      <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="break-words min-w-0">{(job.customer as any).email}</span>
                    </p>
                  )}
                </div>
              </CollapsibleContent>

              <div
                className={cn(
                  "flex items-center gap-2 flex-nowrap",
                  headerInfoOpen ? "order-3 w-full justify-start" : "order-1",
                )}
              >
                <Button
                  aria-label="Call"
                  variant="secondary"
                  size="icon"
                  onClick={handleCall}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="Message"
                  variant="secondary"
                  size="icon"
                  onClick={handleText}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="Navigate"
                  variant="secondary"
                  size="icon"
                  onClick={handleNavigate}
                >
                  <Navigation className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  aria-label="Client Portal"
                  variant="secondary"

                  onClick={handleOpenClientPortal}
                >
                  <Share2 className="h-4 w-4" />
                  Client Portal
                </Button>
              </div>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-w-[var(--content-max-width)] m-auto">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div data-testid="job-details-left-column">
            <div className="bg-card border border-border rounded-lg overflow-hidden" data-testid="job-details-left-card">
              <div className="flex items-center border-b border-border px-4">
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
              <div className="space-y-4 p-5 md:p-6">
                {activeTab === "details" && (
              <>
                {/* Schedule */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2 justify-between">

                      <div className="flex gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {jobAny.recurring_job_id ? "Scheduled Dates" : "Schedule"}
                        </p>
                      </div>



                        
                   
              
                  </div>

                  {schedulesLoading ? (
                    <div className="flex justify-center py-2 ">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : hasSchedules ? (
                    <div className="flex flex-col gap-8 mb-4">
                      {schedules.map((schedule) => {
                        const outsideHours = isOutsideBusinessHours(
                          businessHours,
                          schedule.scheduled_date,
                          schedule.scheduled_time_start,
                          schedule.scheduled_time_end
                        );
                        const scheduleAssignments = getScheduleAssignments(schedule.id);
                        const scheduleTimeRange = formatScheduleTimeRange(
                          schedule.scheduled_time_start,
                          schedule.scheduled_time_end
                        );

                        return (
                          <div key={schedule.id} className="rounded-xl">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center border border-border rounded-2xl bg-muted text-foreground">
                                  <p className="text-[10px] font-semibold leading-none tracking-wide">
                                    {format(new Date(schedule.scheduled_date + "T00:00:00"), "MMM").toUpperCase()}
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold leading-none">
                                    {format(new Date(schedule.scheduled_date + "T00:00:00"), "d")}
                                  </p>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-lg font-semibold leading-tight text-foreground ">
                                      {format(new Date(schedule.scheduled_date + "T00:00:00"), "EEE, MMM d")}
                                    </p>
                                  </div>
                                  {outsideHours && (
                                    <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-400">
                                      Outside normal hours
                                    </Badge>
                                  )}

                                  {scheduleTimeRange && (
                                    <p className="mt-0.5 text-xs  text-muted-foreground">
                                      {scheduleTimeRange}
                                    </p>
                                  )}
                                  {scheduleAssignments.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {scheduleAssignments.map((assignment) => (
                                        <Badge key={assignment.id} variant="outline" className="text-xs text-muted-foreground py-0">
                                          {assignment.profiles?.full_name || "Unknown"}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {isManager() && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openEditCrewDialog(schedule.id)}
                                          className="h-7 px-2 text-xs text-muted-foreground"
                                        >
                                          Assign crew member
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isManager() && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditCrewDialog(schedule.id)}
                                    className="h-7 w-7 p-0 text-muted-foreground"
                                    aria-label="Edit crew"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="flex items-center p-2 bg-secondary/50 rounded-md">
                        <p className="text-sm font-medium text-muted-foreground">
                          No date scheduled
                        </p>
                      </div>
                    </div>
                  )}
                       {isManager() && !jobAny.recurring_job_id && (
                          <Button
                            variant="outline"
                            size="sm"

                            onClick={openScheduleDialog}
                          >
                            <Plus className="h-4 w-4 shrink-0" />
                            Add Date
                          </Button>
                        )}


                  </div>


                {/* Job Schedule Info */}
                {recurringJobData && (
                  <button
                    onClick={() => setRecurringDetailModalOpen(true)}
                    className="w-full text-left transition-colors hover:bg-muted/40 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20"
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

                {/* Crew */}
                {job.crew_lead && (
                  <div>
                    <div className="flex items-start gap-3 mb-3">
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
              </>
            )}

            {activeTab === "checklist" && id && (
              <>
                <div className="flex gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    log your hours
                  </p>
                </div>
                <JobTimeTracker
                  jobId={id}
                  jobAddress={clientAddress || null}
                  accountId={currentAccount?.id}
                  embedded
                />
                
                <div className="py-4">
                  <Separator />
                </div>

                <div className="flex gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    checklist items
                  </p>
                </div>
                <JobChecklist
                  jobId={id}
                  jobStatus={job?.status}
                  isEstimateVisit={job?.is_estimate_visit}
                  clientPortalUrl={portalLink || null}
                  isManager={isManager()}
                  hasBeforePhotos={hasBeforePhotos}
                  embedded
                  onMarkComplete={async () => {
                    if (job?.is_estimate_visit) {
                      await new Promise(resolve => setTimeout(resolve, 1000));

                      const { data: newJob } = await supabase
                        .from("leads")
                        .select("*")
                        .eq("estimate_job_id", id)
                        .eq("is_estimate_visit", false)
                        .eq("status", "job")
                        .maybeSingle();

                      if (newJob) {
                        queryClient.invalidateQueries({ queryKey: ["jobs"] });
                        queryClient.invalidateQueries({ queryKey: ["leads"] });
                        toast.success("Job created from estimate visit!");
                        navigate(`/jobs/${newJob.id}`);
                      } else {
                        queryClient.invalidateQueries({ queryKey: ["jobs"] });
                        queryClient.invalidateQueries({ queryKey: ["leads"] });
                      }
                    } else {
                      const { error } = await supabase
                        .from("leads")
                        .update({ status: "completed" })
                        .eq("id", id);

                      if (error) {
                        console.error("Failed to mark job as complete:", error);
                        throw error;
                      }

                      await queryClient.invalidateQueries({ queryKey: ["job", id] });
                      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
                      await queryClient.invalidateQueries({ queryKey: ["leads"] });
                    }
                  }}
                />
              </>
            )}

            {activeTab === "photos" && id && (
              <>
                <PhotoSection
                  leadId={job?.is_estimate_visit && parentLeadId ? parentLeadId : id}
                  photoType="before"
                  title="Before Photos"
                  onPhotosChange={() => fetchBeforePhotos()}
                  onJobConverted={handleJobConverted}
                  embedded
                />
                {!job?.is_estimate_visit && (
                  <PhotoSection
                    leadId={id}
                    photoType="after"
                    title="After Photos"
                    onPhotosChange={() => fetchAfterPhotos()}
                    embedded
                  />
                )}
              </>
            )}

            {activeTab === "notes" && (
              <>
                <div className="flex gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    notes
                  </p>
                </div>
                <div>
                  <MentionInput
                    value={newNote}
                    onChange={setNewNote}
                    placeholder="Add a note... (use @ to mention team members)"
                    rows={2}
                    teamMembers={teamMembers}
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
                      <div key={note.id} className="flex gap-4 py-3 border-b last:border-b-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="flex-1 items-center justify-between gap-2 mb-0.5">
                          <p className="text-3 whitespace-pre-wrap">
                            {parseMentionsForDisplay(note.body || note.summary || "").map((part, idx) =>
                              part.type === 'mention' ? (
                                <span key={idx} className="font-bold text-primary">@{part.content}</span>
                              ) : (
                                <span key={idx}>{part.content}</span>
                              )
                            )}
                          </p>

                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
              </div>
            </div>
          </div>

          <div className="space-y-4" data-testid="job-details-right-column">
            {/* Estimate / Quote */}
            {displayEstimate ? (
              <DetailEstimateCard
                label={jobAny.recurring_job_id ? "Quote" : "Estimate"}
                status={String(displayEstimate.status || "draft")}
                total={Number(displayEstimate.total)}
                lineItemCount={displayEstimate.line_items?.length || 0}
                onClick={() => navigate(`/payments/estimates/${displayEstimate.id}`)}
              />
            ) : !estimateLoading ? (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => void openBuildEstimateModal()}
              >
                <DollarSign className="h-4 w-4" />
                Build Estimate
              </Button>
            ) : null}

            {/* Job Costs */}
            {id && <JobCosts jobId={id} />}

            {/* Invoices Section */}
            {isManager() && id && (
              <JobInvoiceCard
                jobId={id}
                customerEmail={job.customer?.email}
                customerName={job.customer?.name}
                estimateTotal={displayEstimate?.total ? Number(displayEstimate.total) : null}
              />
            )}
          </div>
        </div>
      </div>

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

      {id && job && (
        <LineItemsEstimateDialog
          open={lineItemsEstimateDialogOpen}
          onOpenChange={setLineItemsEstimateDialogOpen}
          lead={{
            id,
            name: job.customer?.name || job.name || "Customer",
            phone: job.customer?.phone || null,
            email: job.customer?.email || null,
            address: job.address || null,
            city: (job as any).city || null,
            service_type: job.service_type || null,
            estimated_value: job.actual_value || null,
          }}
          onSuccess={handleEstimateSuccess}
        />
      )}

      <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Portal Link</DialogTitle>
            <DialogDescription>
              Share this link with your client so they can view their jobs, estimates, and invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={portalLink}
              readOnly
              className="flex-1"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyPortalLink}
            >
              {portalCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPortalDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusGuidanceOpen} onOpenChange={setStatusGuidanceOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Status Stages</DialogTitle>
            <DialogDescription>
              Use this guide to understand what each job status means and what needs to happen before moving a job into that stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {JOB_STATUS_GUIDANCE.map((stage) => (
              <div key={stage.value} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex justify-start">
                  {stage.value === "unassigned" ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-[hsl(var(--status-attention))]/40 bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Unassigned
                    </Badge>
                  ) : stage.value === "needs_invoice" ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-[hsl(var(--status-attention))]/40 bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Needs Invoice
                    </Badge>
                  ) : (
                    <StatusBadge status={getJobStatusBadgeStatus(stage.value) as any} size="lg">
                      {stage.label}
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
                <p className="mt-2 text-sm text-foreground">
                  <span className="font-medium">To get here:</span> {stage.requirement}
                </p>
              </div>
            ))}
          </div>
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
              Update job information. To edit customer details, visit the customer page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
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
            <AlertDialogTitle>{deleteJobConfig.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteJobConfig.dialogDescription}
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

      <Dialog
        open={editCrewDialogOpen}
        onOpenChange={(open) => {
          setEditCrewDialogOpen(open);
          if (!open) {
            setEditingCrewScheduleId(null);
            setEditingCrewUserIds([]);
            setEditingScheduleDate("");
            setEditingScheduleTimeStart("");
            setEditingScheduleTimeEnd("");
            setEditingSuppressUnassigned(false);
            setEditScheduleDeleteConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Crew</DialogTitle>
            <DialogDescription>
              Update this scheduled date, crew assignment, or assigned-state override.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-schedule-date">Date</Label>
              <Input
                id="edit-schedule-date"
                type="date"
                value={editingScheduleDate}
                onChange={(event) => setEditingScheduleDate(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-start-time">Start Time</Label>
                <Input
                  id="edit-schedule-start-time"
                  type="time"
                  value={editingScheduleTimeStart}
                  onChange={(event) => setEditingScheduleTimeStart(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-end-time">End Time</Label>
                <Input
                  id="edit-schedule-end-time"
                  type="time"
                  value={editingScheduleTimeEnd}
                  onChange={(event) => setEditingScheduleTimeEnd(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Mark as assigned</p>
                  <p className="text-xs text-muted-foreground">
                    Suppress the unassigned state for this scheduled visit without assigning a crew member.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={editingSuppressUnassigned ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditingSuppressUnassigned((value) => !value)}
                >
                  {editingSuppressUnassigned ? "Marked as assigned" : "Mark as assigned"}
                </Button>
              </div>
            </div>

            {teamMembers.length > 0 ? (
              <div className="max-h-72 overflow-y-auto border rounded-md">
                {teamMembers.map((member) => {
                  const memberId = `edit-crew-${member.user_id}`;
                  const isSelected = editingCrewUserIds.includes(member.user_id);
                  return (
                    <div key={member.user_id} className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={memberId}
                          checked={isSelected}
                          onCheckedChange={() => toggleEditingCrewUser(member.user_id)}
                        />
                        <Label htmlFor={memberId} className="font-normal cursor-pointer">
                          {member.full_name || "Unnamed"}
                        </Label>
                      </div>
                      <Badge variant="outline" className="text-xs py-0">
                        {member.role ? member.role.replace("_", " ") : "team"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No crew members available</p>
            )}
            <p className="text-xs text-muted-foreground">
              {editingCrewUserIds.length} crew member{editingCrewUserIds.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
            {!jobAny.recurring_job_id && (
              <Button
                variant="outline"
                onClick={() => setEditScheduleDeleteConfirmOpen(true)}
                className="order-3 h-10 w-10 p-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:order-1 sm:mr-auto"
                aria-label="Delete scheduled date"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditCrewDialogOpen(false)}
              className="order-2 flex-1 sm:order-2 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCrewAssignments}
              disabled={savingCrewAssignments}
              className="order-1 w-full sm:order-3 sm:w-auto"
            >
              {savingCrewAssignments ? "Saving..." : "Save Crew"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={editScheduleDeleteConfirmOpen} onOpenChange={setEditScheduleDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove scheduled date?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove only this scheduled date from the job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEditedSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Date
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
