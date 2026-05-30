import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapPin, User, Phone, MessageSquare, EllipsisVertical, SquareCheck as CheckSquare, FileText, DollarSign, Calendar, Clock, Pencil as Edit, Trash2, Archive, MoveVertical as MoreVertical, Plus, Info, Unlink, Hammer, Navigation, ChevronDown, Mail, Share2, AlertTriangle, Receipt, ScanLine, Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { checkAssignmentOverlapSecure } from "@/lib/secureRpc";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { isOutsideBusinessHours } from "@/lib/businessHours";
import { Badge } from "@/components/ui/badge";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { isTwilioNotConfiguredErrorMessage, shouldUsePortalFallback } from "@/lib/jobCompletionReview";
import { buildClientPortalShareUrl } from "@/lib/clientPortalUrl";
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
import { JobDocumentsSection } from "@/components/jobs/JobDocumentsSection";
import { LineItemsEstimateDialog } from "@/components/leads/LineItemsEstimateDialog";
import { MentionInput } from "@/components/ui/mention-input";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { extractMentions, parseMentionsForDisplay } from "@/lib/mentionParser";
import { getDetailDeleteConfig } from "@/lib/detailDeleteConfig";
import { isMissingSuppressUnassignedColumn } from "@/lib/suppressUnassignedFallback";
import { buildMockCrewAssigneeId, parseCrewAssigneeId } from "@/lib/crewIdentifiers";
import { isSinglePersonCompany as isSinglePersonCompanyByMembers } from "@/lib/teamMembers";
import { applyCustomerContactToJob } from "@/lib/jobCustomerCache";
import { getJobAssignmentInsertErrorMessage, getSupabaseErrorMessage, isPermissionDeniedError } from "@/lib/supabaseErrors";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { DetailEstimateCard } from "@/components/shared/DetailEstimateCard";
import { ClientPortalLinkDialog } from "@/components/shared/ClientPortalLinkDialog";
import { MonthDayDateBadge } from "@/components/shared/MonthDayDateBadge";
import { Separator } from "@/components/ui/separator";
import { getEstimateCardTotal } from "@/lib/estimateCardTotals";
import { useIsMobile } from "@/hooks/use-mobile";
import { ServiceTypeSelect } from "@/components/shared/ServiceTypeSelect";
import { useServiceTypeOptions } from "@/hooks/useServiceTypeOptions";

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

const readPaymentSchedulePercent = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const formatPaymentSchedulePercent = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/u, "");

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager, user, currentAccount } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "photos" | "documents">("details");
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
    customer_address: "",
    customer_city: "",
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
  const isSinglePersonCompany = isSinglePersonCompanyByMembers(teamMembers);
  const [hasInvoice, setHasInvoice] = useState(false);
  const [lineItemsEstimateDialogOpen, setLineItemsEstimateDialogOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalLink, setPortalLink] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const [portalEmailSending, setPortalEmailSending] = useState(false);
  const [portalEmailSent, setPortalEmailSent] = useState(false);
  const [portalClientPhone, setPortalClientPhone] = useState("");
  const [portalClientEmail, setPortalClientEmail] = useState("");
  const [portalLastViewedAt, setPortalLastViewedAt] = useState<string | null>(null);
  const [isTwilioConfigured, setIsTwilioConfigured] = useState(true);
  const [headerInfoOpen, setHeaderInfoOpen] = useState(false);
  const [openLogPaymentSignal, setOpenLogPaymentSignal] = useState(0);
  const [scanReceiptSignal, setScanReceiptSignal] = useState(0);
  const [viewCostsSignal, setViewCostsSignal] = useState(0);
  const [addCostsSignal, setAddCostsSignal] = useState(0);
  const [editCostsMenuOpen, setEditCostsMenuOpen] = useState(false);
  const serviceTypeOptions = useServiceTypeOptions(editDialogOpen);

  const isAutoGeneratedPlaceholderEstimate = (value: any) =>
    !!value &&
    value.status === "draft" &&
    Number(value.total || 0) === 0 &&
    (value.line_items?.length || 0) === 0 &&
    typeof value.notes === "string" &&
    value.notes.startsWith("Auto-generated estimate for ");

  const displayEstimate = isAutoGeneratedPlaceholderEstimate(estimate) ? null : estimate;
  const estimateVersions = Array.isArray(displayEstimate?.versions) ? displayEstimate.versions : [];
  const hasMultipleEstimateVersions = estimateVersions.length > 1;
  const isAcceptedEstimate = String(displayEstimate?.status || "") === "accepted";
  const estimateCardTotal = getEstimateCardTotal(displayEstimate);
  const scopeOfWorkFromTasks = (() => {
    const taskLines = checklistItems
      .filter((item) => {
        const rawCategory =
          item.metadata &&
          typeof item.metadata === "object" &&
          "category" in item.metadata &&
          typeof item.metadata.category === "string"
            ? item.metadata.category
            : "standard";
        const category = rawCategory === "task" || rawCategory === "tool" || rawCategory === "material"
          ? rawCategory
          : "standard";
        return category === "task" || category === "standard";
      })
      .map((item) => {
        const label = String(item.label || "").trim();
        if (!label) return "";
        const description = typeof item.metadata?.description === "string"
          ? item.metadata.description.trim()
          : "";
        return description ? `${label}: ${description}` : label;
      })
      .filter(Boolean);

    if (taskLines.length === 0) {
      return "No scope of work created";
    }

    return taskLines.map((line, index) => `${index + 1}. ${line}`).join("\n");
  })();
  const defaultPaymentScheduleRaw =
    currentAccount?.settings &&
    typeof currentAccount.settings === "object" &&
    !Array.isArray(currentAccount.settings) &&
    "default_payment_schedule" in currentAccount.settings
      ? (currentAccount.settings as Record<string, any>).default_payment_schedule
      : null;
  const defaultPaymentSchedule =
    defaultPaymentScheduleRaw &&
    typeof defaultPaymentScheduleRaw === "object" &&
    !Array.isArray(defaultPaymentScheduleRaw)
      ? {
          deposit: readPaymentSchedulePercent((defaultPaymentScheduleRaw as Record<string, unknown>).deposit_percentage, 33),
          midpoint: readPaymentSchedulePercent((defaultPaymentScheduleRaw as Record<string, unknown>).midpoint_percentage, 33),
          final: readPaymentSchedulePercent((defaultPaymentScheduleRaw as Record<string, unknown>).final_percentage, 34),
        }
      : {
          deposit: 33,
          midpoint: 33,
          final: 34,
        };
  const defaultPaymentScheduleSummary = `Deposit ${formatPaymentSchedulePercent(defaultPaymentSchedule.deposit)}%, Midpoint ${formatPaymentSchedulePercent(defaultPaymentSchedule.midpoint)}%, Final ${formatPaymentSchedulePercent(defaultPaymentSchedule.final)}%`;

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
    if (!isMobile) return;

    setActiveTab((currentTab) => (currentTab === "details" ? "checklist" : currentTab));
  }, [isMobile]);

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
          const updatedOrder = candidate.order("updated_at", { ascending: false });
          if (updatedOrder && typeof updatedOrder.order === "function") {
            const createdOrder = updatedOrder.order("created_at", { ascending: false });
            if (createdOrder && typeof createdOrder.limit === "function") {
              return createdOrder.limit(1) as T;
            }
            return createdOrder as T;
          }

          if (updatedOrder && typeof updatedOrder.limit === "function") {
            return updatedOrder.limit(1) as T;
          }
          return updatedOrder as T;
        }
        return query;
      };

      const fetchPreferredEstimate = async (buildQuery: () => any) => {
        const baseAcceptedQuery = buildQuery();
        const acceptedQuery =
          baseAcceptedQuery && typeof baseAcceptedQuery.eq === "function"
            ? baseAcceptedQuery.eq("status", "accepted")
            : baseAcceptedQuery;

        const { data: acceptedEstimate, error: acceptedError } = await latestOnly(acceptedQuery).maybeSingle();
        if (acceptedError) throw acceptedError;
        if (acceptedEstimate) return acceptedEstimate;

        const { data: latestEstimate, error: latestError } = await latestOnly(buildQuery()).maybeSingle();
        if (latestError) throw latestError;
        return latestEstimate;
      };

      const { data: currentJob } = await supabase
        .from("leads")
        .select("recurring_job_id")
        .eq("id", id)
        .maybeSingle();

      if (currentJob?.recurring_job_id) {
        const masterQuote = await fetchPreferredEstimate(() =>
          supabase
            .from("estimates")
            .select("id, total, subtotal, tax, discount, status, sent_at, viewed_at, has_pending_changes, notes, agreement_templates, line_items:estimate_line_items(id, name, description, quantity, unit), versions:estimate_versions(id, total)")
            .eq("recurring_job_id", currentJob.recurring_job_id),
        );
        setEstimate(masterQuote);
        setEstimateLoading(false);
        return;
      }

      let data = await fetchPreferredEstimate(() =>
        supabase
          .from("estimates")
          .select("id, total, subtotal, tax, discount, status, sent_at, viewed_at, has_pending_changes, notes, agreement_templates, line_items:estimate_line_items(id, name, description, quantity, unit), versions:estimate_versions(id, total)")
          .eq("job_id", id),
      );

      if (!data) {
        const { data: parentLead } = await supabase
          .from("leads")
          .select("id")
          .eq("estimate_job_id", id)
          .maybeSingle();

        if (parentLead) {
          data = await fetchPreferredEstimate(() =>
            supabase
              .from("estimates")
              .select("id, total, subtotal, tax, discount, status, sent_at, viewed_at, has_pending_changes, notes, agreement_templates, line_items:estimate_line_items(id, name, description, quantity, unit), versions:estimate_versions(id, total)")
              .eq("job_id", parentLead.id),
          );
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
  const getPhoneUriValue = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const trimmed = phone.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("+")
      ? `+${trimmed.slice(1).replace(/\D/g, "")}`
      : trimmed.replace(/\D/g, "");
  };
  const normalizedClientPhone = getPhoneUriValue(clientPhone);
  const callHref = normalizedClientPhone ? `tel:${normalizedClientPhone}` : "";
  const textHref = normalizedClientPhone ? `sms:${normalizedClientPhone}` : "";
  const isWindowsDesktop = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  const clientAddress = [job.address, job.city].filter(Boolean).join(", ");
  const jobDescription = (job.description || job.notes || "").trim();
  const hasSchedules = schedules && schedules.length > 0;

  const handleCall = () => {
    if (!callHref) {
      toast.error("Add a customer phone number before calling.");
      return;
    }
    window.open(callHref);
  };

  const handleText = () => {
    if (!textHref) {
      toast.error("Add a customer phone number before sending a text.");
      return;
    }
    if (isWindowsDesktop) {
      navigator.clipboard.writeText(normalizedClientPhone).catch(() => undefined);
      toast.error("SMS app handoff is not supported in this browser on Windows. Phone number copied.");
      return;
    }
    window.open(textHref);
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

  const resolveClientPortalLink = async () => {
    const customerId = job?.customer?.id;
    if (!customerId) {
      throw new Error("No customer linked to this job");
    }

    const readCustomerPortalFields = async (includeViewTracking: boolean) =>
      supabase
        .from("customers")
        .select(
          includeViewTracking
            ? "client_portal_token, phone, email, portal_last_viewed_at"
            : "client_portal_token, phone, email",
        )
        .eq("id", customerId)
        .maybeSingle();

    let { data: customer, error: fetchError } = await readCustomerPortalFields(true);
    const isMissingPortalViewColumn = Boolean(
      fetchError &&
        typeof fetchError === "object" &&
        "code" in fetchError &&
        (fetchError as { code?: string }).code === "PGRST204",
    );
    if (isMissingPortalViewColumn) {
      const fallback = await readCustomerPortalFields(false);
      customer = fallback.data;
      fetchError = fallback.error;
    }

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

    return {
      link: buildClientPortalShareUrl(token, {
        customDomain: currentAccount?.settings?.website?.custom_domain ?? null,
      }),
      phone: customer?.phone?.trim() || "",
      email: customer?.email?.trim() || "",
      lastViewedAt:
        customer && typeof customer === "object" && "portal_last_viewed_at" in customer
          ? ((customer as { portal_last_viewed_at?: string | null }).portal_last_viewed_at ?? null)
          : null,
    };
  };

  const handleOpenClientPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const portalData = await resolveClientPortalLink();
      setPortalLink(portalData.link);
      setPortalClientPhone(portalData.phone);
      setPortalClientEmail(portalData.email);
      setPortalLastViewedAt(portalData.lastViewedAt);
      setPortalEmailSent(false);
      setPortalDialogOpen(true);
    } catch (err) {
      toast.error("Failed to generate portal link");
    } finally {
      setPortalLoading(false);
    }
  };

  const triggerJobCompletionAutomation = (completedJob: { id: string; name?: string; service_type?: string; scheduled_date?: string; scheduled_time_start?: string }) => {
    const automation = (currentAccount?.settings as any)?.job_message_automation;
    if (!automation?.enabled || !currentAccount?.id) return;

    const renderMsg = (tpl: string) => {
      const firstName = (completedJob.name || "").split(" ")[0] || "";
      return tpl
        .replace(/\{\{job_name\}\}/g, completedJob.name || "")
        .replace(/\{\{client_name\}\}/g, completedJob.name || "")
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{service_type\}\}/g, completedJob.service_type || "")
        .replace(/\{\{job_status\}\}/g, "completed")
        .replace(/\{\{lead_id\}\}/g, completedJob.id)
        .replace(/\{\{scheduled_date\}\}/g, completedJob.scheduled_date || "")
        .replace(/\{\{scheduled_time\}\}/g, completedJob.scheduled_time_start || "")
        .replace(/\{\{scheduled_datetime\}\}/g, [completedJob.scheduled_date, completedJob.scheduled_time_start].filter(Boolean).join(" "))
        .trim();
    };

    const templates = automation.message_templates?.length
      ? automation.message_templates
      : automation.message_template
        ? [{ content: automation.message_template, is_finished: true, delivery_channel: "text" as const, job_service_types: automation.job_service_types, trigger: automation.trigger }]
        : [];

    for (const template of templates) {
      if (!template.is_finished || !template.content?.trim()) continue;
      if (template.trigger?.type !== "after_job_completion") continue;

      const offsetValue = template.trigger?.offset_value ?? template.trigger?.offset_minutes ?? 0;
      const offsetUnit = template.trigger?.offset_unit ?? (template.trigger?.offset_minutes != null ? "minutes" : "seconds");
      const offsetSeconds = offsetUnit === "seconds" ? offsetValue
        : offsetUnit === "minutes" ? offsetValue * 60
        : offsetUnit === "hours" ? offsetValue * 3600
        : offsetUnit === "days" ? offsetValue * 86400
        : offsetValue * 60;
      if (offsetSeconds > 0) continue;

      const serviceTypes = template.job_service_types ?? [];
      if (serviceTypes.length > 0 && completedJob.service_type && !serviceTypes.includes(completedJob.service_type)) continue;

      const renderedMessage = renderMsg(template.content.trim());
      if (!renderedMessage) continue;

      supabase.functions.invoke("send-job-automation-message", {
        body: {
          account_id: currentAccount.id,
          lead: { id: completedJob.id, account_id: currentAccount.id },
          message: renderedMessage,
          template: { delivery_channel: template.delivery_channel ?? "text" },
        },
      }).catch((err) => console.error("Job completion automation error:", err));
    }
  };

  const sendCompletionReviewRequest = async ({
    openPortalDialogOnFallback = false,
  }: {
    openPortalDialogOnFallback?: boolean;
  } = {}) => {
    if (!job?.customer?.id || !currentAccount?.id) return;

    const portalFallback = shouldUsePortalFallback(isTwilioConfigured, job.customer.phone);
    const portalData = await resolveClientPortalLink();
    const portalLink = portalData.link;
    setPortalLastViewedAt(portalData.lastViewedAt);

    if (portalFallback) {
      setPortalLink(portalLink);
      setPortalClientPhone(portalData.phone);
      setPortalClientEmail(portalData.email);
      setPortalEmailSent(false);
      if (openPortalDialogOnFallback) {
        setPortalDialogOpen(true);
        toast.success("Job completed. Share the client portal link to request a review.");
      } else {
        toast.success("Job completed");
      }
      return;
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "tasks",
        account_id: currentAccount.id,
        data: {
          summary: `Please leave us a review for ${job.name || "your recent job"}: ${portalLink}`,
          user_id: user?.id,
          lead_id: job.id,
        },
      }),
    });

    const result = await response.json().catch(() => null);
    const errorMessage = String(result?.error || "");
    if (!response.ok || errorMessage) {
      if (isTwilioNotConfiguredErrorMessage(errorMessage)) {
        setIsTwilioConfigured(false);
        setPortalLink(portalLink);
        setPortalEmailSent(false);
        if (openPortalDialogOnFallback) {
          setPortalDialogOpen(true);
          toast.success("Job completed. Share the client portal link to request a review.");
        } else {
          toast.success("Job completed");
        }
        return;
      }
      throw new Error(errorMessage || "Failed to send review request");
    }

    toast.success("Review request sent to the contact");
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

  const handleEmailPortalLink = async () => {
    if (!job?.customer?.id || !portalLink) {
      toast.error("Open the client portal link first.");
      return;
    }

    const clientEmail = portalClientEmail || job.customer?.email?.trim() || "";
    if (!clientEmail) {
      toast.error("Add a customer email before sending.");
      return;
    }

    setPortalEmailSending(true);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const accessToken =
        refreshData.session?.access_token ||
        (await supabase.auth.getSession()).data.session?.access_token;

      if (refreshError || !accessToken) {
        toast.error("Your session expired. Please sign in again and retry.");
        return;
      }

      const { error } = await supabase.functions.invoke("send-client-portal-email", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          customer_id: job.customer.id,
          job_id: job.id,
          job_name: job.name || null,
          portal_link: portalLink,
        },
      });

      if (error) {
        throw error;
      }

      setPortalEmailSent(true);
      setTimeout(() => setPortalEmailSent(false), 2500);
      toast.success(`Portal link emailed to ${clientEmail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send portal email";
      if (message.toLowerCase().includes("failed to fetch")) {
        toast.error("Email service unavailable. Deploy the send-client-portal-email function and retry.");
      } else {
        toast.error(message);
      }
    } finally {
      setPortalEmailSending(false);
    }
  };

  const handleTextPortalLink = async () => {
    const fallbackPhone = getPhoneUriValue(portalClientPhone || job?.customer?.phone || "");
    const fallbackToSmsApp = () => {
      if (!fallbackPhone) {
        toast.error("Add a customer phone number before sending a text.");
        return;
      }
      if (isWindowsDesktop) {
        navigator.clipboard.writeText(fallbackPhone).catch(() => undefined);
        toast.error("SMS app handoff is not supported in this browser on Windows. Phone number copied.");
        return;
      }
      window.open(`sms:${fallbackPhone}`, "_blank");
      setPortalDialogOpen(false);
    };

    if (!currentAccount?.id || !job) {
      fallbackToSmsApp();
      return;
    }

    try {
      let resolvedPortalLink = portalLink;
      if (!resolvedPortalLink) {
        const portalData = await resolveClientPortalLink();
        resolvedPortalLink = portalData.link;
        setPortalLink(portalData.link);
        setPortalClientPhone(portalData.phone);
        setPortalClientEmail(portalData.email);
        setPortalLastViewedAt(portalData.lastViewedAt);
      }

      const { data, error } = await supabase.functions.invoke("send-job-automation-message", {
        body: {
          account_id: currentAccount.id,
          lead: {
            id: job.id,
            account_id: currentAccount.id,
          },
          message: `Here is the client portal for your project with ${currentAccount?.company_name || "our company"}: ${resolvedPortalLink}`,
          template: {
            delivery_channel: "text",
          },
        },
      });

      const errorMessage = String(error?.message || "");
      if (errorMessage) {
        if (isTwilioNotConfiguredErrorMessage(errorMessage) || errorMessage.toLowerCase().includes("twilio")) {
          setIsTwilioConfigured(false);
          fallbackToSmsApp();
          return;
        }
        throw new Error(errorMessage || "Failed to send client portal text");
      }

      const smsSent = data && typeof data === "object" && "sms_sent" in data ? Boolean(data.sms_sent) : false;
      const smsError =
        data && typeof data === "object" && "sms_error" in data
          ? String(data.sms_error || "")
          : "";
      const skipReason =
        data && typeof data === "object" && "reason" in data
          ? String(data.reason || "")
          : "";

      if (!smsSent) {
        const reason = smsError || skipReason || "Failed to send client portal text";
        if (isTwilioNotConfiguredErrorMessage(reason) || reason.toLowerCase().includes("twilio")) {
          setIsTwilioConfigured(false);
          fallbackToSmsApp();
          return;
        }
        throw new Error(reason);
      }

      toast.success("Portal link text sent to the contact");
      setPortalDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send client portal text";
      toast.error(message);
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

  const getAssignmentAssigneeId = (assignment: { user_id: string | null; mock_crew_profile_id?: string | null }) => {
    if (assignment.user_id) return assignment.user_id;
    if (assignment.mock_crew_profile_id) return buildMockCrewAssigneeId(assignment.mock_crew_profile_id);
    return "";
  };

  const openEditCrewDialog = (scheduleId: string) => {
    const schedule = schedules.find((item) => item.id === scheduleId);
    const assignedUserIds = getScheduleAssignments(scheduleId)
      .map((assignment) => getAssignmentAssigneeId(assignment))
      .filter(Boolean);
    setEditingCrewScheduleId(scheduleId);
    setEditingCrewUserIds([...new Set(assignedUserIds)]);
    setEditingScheduleDate(schedule?.scheduled_date || "");
    setEditingScheduleTimeStart(schedule?.scheduled_time_start || "");
    setEditingScheduleTimeEnd(schedule?.scheduled_time_end || "");
    setEditingSuppressUnassigned(Boolean(schedule?.suppress_unassigned));
    setEditCrewDialogOpen(true);
  };

  const toggleEditingCrewUser = (userId: string) => {
    if (editingSuppressUnassigned) return;
    setEditingCrewUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const toggleEditingSuppressUnassigned = (checked: boolean) => {
    if (editingCrewUserIds.length > 0) return;
    setEditingSuppressUnassigned(checked);
    if (checked) {
      setEditingCrewUserIds([]);
    }
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
    const currentUserIds = [...new Set(currentAssignments.map((assignment) => getAssignmentAssigneeId(assignment)).filter(Boolean))];
    const usersToAdd = editingCrewUserIds.filter((userId) => !currentUserIds.includes(userId));
    const assignmentIdsToRemove = currentAssignments
      .filter((assignment) => !editingCrewUserIds.includes(getAssignmentAssigneeId(assignment)))
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
        const baseScheduleUpdate = {
          scheduled_date: editingScheduleDate,
          scheduled_time_start: editingScheduleTimeStart || null,
          scheduled_time_end: editingScheduleTimeEnd || null,
          updated_at: new Date().toISOString(),
        };

        let { error: scheduleError } = await supabase
          .from("job_schedules")
          .update({
            ...baseScheduleUpdate,
            suppress_unassigned: editingSuppressUnassigned,
          })
          .eq("id", editingCrewScheduleId);

        if (isMissingSuppressUnassignedColumn(scheduleError)) {
          const fallback = await supabase
            .from("job_schedules")
            .update(baseScheduleUpdate)
            .eq("id", editingCrewScheduleId);
          scheduleError = fallback.error;

          if (!scheduleError && editingSuppressUnassigned) {
            toast.error("Mark as assigned is not available until the latest database migration is applied.");
            return;
          }
        }

        if (scheduleError) throw scheduleError;
      }

      for (const userId of usersToAdd) {
        const parsed = parseCrewAssigneeId(userId);
        let hasOverlap = false;

        try {
          hasOverlap = await checkAssignmentOverlapSecure({
            accountId: currentAccount.id,
            scheduleId: editingCrewScheduleId,
            userId: parsed.type === "user" ? parsed.userId : null,
            mockProfileId: parsed.type === "mock" ? parsed.mockProfileId : null,
          });
        } catch (overlapError) {
          if (!isPermissionDeniedError(overlapError)) {
            throw new Error(getSupabaseErrorMessage(overlapError, "Failed to validate crew availability"));
          }

          // Fall through to INSERT; database constraints still enforce overlap and account rules.
          console.warn("secure-assignment-overlap check was denied; continuing with database-enforced validation");
        }

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
            usersToAdd.map((userId) => {
              const parsed = parseCrewAssigneeId(userId);
              return {
                lead_id: id,
                user_id: parsed.type === "user" ? parsed.userId : null,
                mock_crew_profile_id: parsed.type === "mock" ? parsed.mockProfileId : null,
                job_schedule_id: editingCrewScheduleId,
                account_id: currentAccount.id,
                assigned_by: user.id,
              };
            }),
          );

        if (addError) {
          throw new Error(getJobAssignmentInsertErrorMessage(addError));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["job-assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["job-schedules", id] });
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["crew-hours"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });

      if (jobAny.recurring_job_id && crewChanged) {
        const realCrewIds = editingCrewUserIds
          .map((assigneeId) => parseCrewAssigneeId(assigneeId))
          .filter((assignee) => assignee.type === "user" && assignee.userId)
          .map((assignee) => assignee.userId as string);

        if (realCrewIds.length > 0) {
          setPendingCrewUserIds(realCrewIds);
          setCrewSavePromptOpen(true);
        }
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
      const message = getSupabaseErrorMessage(error, "Failed to update crew assignments");
      toast.error(message || "Failed to update crew assignments");
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
    const rawJobAddress = job?.address?.trim() || "";
    const customerCity = job?.customer?.city?.trim() || "";
    const normalizedAddress = rawJobAddress.toLowerCase();
    const normalizedCity = customerCity.toLowerCase();
    const addressWithCity =
      rawJobAddress && customerCity && !normalizedAddress.includes(normalizedCity)
        ? `${rawJobAddress}, ${customerCity}`
        : rawJobAddress;

    setEditForm({
      name: job?.name || "",
      service_type: job?.service_type || "",
      address: addressWithCity,
      description: job?.description || "",
      customer_name: job?.customer?.name || "",
      customer_phone: job?.customer?.phone || "",
      customer_email: job?.customer?.email || "",
      customer_address: job?.customer?.address || "",
      customer_city: job?.customer?.city || "",
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

      if (job?.customer?.id) {
        const { error: customerError } = await supabase
          .from("customers")
          .update({
            name: editForm.customer_name.trim() || null,
            phone: editForm.customer_phone.trim() || null,
            email: editForm.customer_email.trim() || null,
            address: editForm.customer_address.trim() || null,
            city: editForm.customer_city.trim() || null,
          })
          .eq("id", job.customer.id);

        if (customerError) throw customerError;

        queryClient.setQueryData(["job", id], (currentJob: unknown) => {
          if (!currentJob || typeof currentJob !== "object") {
            return currentJob;
          }
          return applyCustomerContactToJob(currentJob as Record<string, unknown>, editForm);
        });

        queryClient.invalidateQueries({ queryKey: ["job", id] });
      }

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
    const newStatus = isCompleted ? "archived" : "cancelled";

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
      toast.success(isCompleted ? "Job archived" : "Job marked as canceled");
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
  const isUnassigned = !isSinglePersonCompany && (schedules.length === 0
    ? jobAssignments.length === 0
    : hasScheduleScopedAssignments
      ? schedules.some((schedule) => !schedule.suppress_unassigned && !assignedScheduleIds.has(schedule.id))
      : schedules.some((schedule) => !schedule.suppress_unassigned) && jobAssignments.length === 0);
  const deleteJobConfig = getDetailDeleteConfig({
    entity: "job",
    name: job.name || "this job",
    isRecurring: !!jobAny.recurring_job_id,
  });
  const mobileQuickActions = [
    {
      icon: <Receipt className="h-5 w-5" />,
      label: "Edit costs",
      onClick: () => setEditCostsMenuOpen(true),
      group: "navigation",
    },
    ...(
      displayEstimate?.id
        ? [{
            icon: <FileText className="h-5 w-5" />,
            label: "View Estimate",
            onClick: () => navigate(`/payments/estimates/${displayEstimate.id}`),
            group: "navigation",
          }]
        : [{
            icon: <Calculator className="h-5 w-5" />,
            label: "Build Estimate",
            onClick: () => void openBuildEstimateModal(),
            group: "navigation",
          }]
    ),
    ...(isManager()
      ? [{
          icon: <DollarSign className="h-5 w-5" />,
          label: "Record Payment",
          onClick: () => setOpenLogPaymentSignal((value) => value + 1),
          group: "navigation",
        }]
      : []),
    {
      icon: <Navigation className="h-5 w-5" />,
      label: "Navigate",
      onClick: handleNavigate,
      group: "navigation",
    },
    {
      icon: <Phone className="h-5 w-5" />,
      label: "Call",
      onClick: handleCall,
      group: "communication",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Message",
      onClick: handleText,
      group: "communication",
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      label: "Send Portal",
      onClick: handleOpenClientPortal,
      group: "communication",
    },
  ];

  return (
    <div className="min-h-screen  bg-surface-sunken pb-24">
      <PageHeader showBack backTo="/jobs" />

      {/* Header */}
      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 pb-3 md:pt-8 md:pb-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 min-w-0 w-full">
            <div
              data-testid="job-detail-badges-row"
              onClick={() => setStatusGuidanceOpen(true)}
              className="hidden md:flex flex-wrap items-center gap-2 cursor-pointer"
            >
              {isUnassigned && (
                <Badge
                  variant="outline"
                  className="text-xs border-[hsl(var(--status-attention))]/40 bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unassigned
                </Badge>
              )}
              {job.status === "completed" && !hasInvoice && !!displayEstimate?.id && (
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
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {remainingChecklistCount} tasks left
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 md:h-16 md:w-16">
                <Hammer className="h-7 w-7 md:h-8 md:w-8" />
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-1 text-2xl md:text-1 break-words">{job.name || "Job"}</p>
                  {isManager() && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 -mt-0.5"
                          aria-label="Open job actions menu"
                        >
                          <EllipsisVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
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
                          {job?.status === "completed" || job?.status === "paid" ? "Archive" : "Mark as Cancelled"}
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
                <button
                  type="button"
                  onClick={() => setHeaderInfoOpen((current) => !current)}
                  className="group mt-1 flex items-center gap-2 p-0 text-muted-foreground"
                >
                  <span className="text-muted-foreground">More info</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      headerInfoOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
            </div>
            <Collapsible
              open={headerInfoOpen}
              onOpenChange={setHeaderInfoOpen}
              data-testid="job-header-actions-row"
              className={cn(
                "w-full flex flex-col gap-0 md:flex-row md:items-center",
                headerInfoOpen ? "md:flex-wrap" : "md:flex-nowrap md:justify-between",
              )}
            >
              <CollapsibleContent className="order-2 w-full space-y-2 rounded-xl border border-border bg-card p-4 text-foreground md:rounded-none md:border-0 md:bg-transparent md:p-0">
                <p className="text-base md:text-sm text-foreground whitespace-pre-wrap">
                  {jobDescription || "No description provided."}
                </p>
                <div className="space-y-2 text-base md:text-sm text-foreground">
                  <p className="flex items-start gap-1">
                    <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {job.customer?.id ? (
                      <Link
                        to={`/customers/${job.customer.id}`}
                        className="break-words min-w-0 hover:text-foreground hover:underline transition-colors"
                      >
                        {job.customer?.name || "Unknown Contact"}
                      </Link>
                    ) : (
                      <span className="break-words min-w-0">{job.customer?.name || "Unknown Contact"}</span>
                    )}
                  </p>
                  <div className="flex items-start gap-1">
                    <Hammer className="h-3.5 w-3.5 shrink-0 mt-0.5" />
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
                  "hidden md:flex items-center gap-2 flex-nowrap",
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
                  aria-label="Send Portal"
                  variant="secondary"

                  onClick={handleOpenClientPortal}
                >
                  <Share2 className="h-4 w-4" />
                  Send Portal
                </Button>
              </div>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-[var(--content-max-width)] m-auto px-4 pb-4 pt-2 md:pt-3">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div data-testid="job-details-left-column">
            <div
              className={cn(
                "bg-card -mx-4 md:mx-0 rounded-none md:rounded-lg md:border md:border-border",
                activeTab === "checklist" ? "overflow-visible" : "overflow-hidden",
              )}
              data-testid="job-details-left-card"
            >
              <div className="grid grid-cols-4 px-2 md:border-b md:border-border">
                {(isMobile
                  ? [
                      { id: "checklist", label: "Tasks" },
                      { id: "details", label: "Schedule" },
                      { id: "photos", label: "Photos" },
                      { id: "documents", label: "Documents" },
                    ]
                  : [
                      { id: "checklist", label: "Tasks" },
                      { id: "details", label: "Schedule" },
                      { id: "photos", label: "Photos" },
                      { id: "documents", label: "Documents" },
                    ]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as "details" | "checklist" | "photos" | "documents");
                      if (tab.id === "checklist") {
                        fetchBeforePhotos();
                      }
                    }}
                    className={cn(
                      "w-full px-2 py-3 text-center text-base font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="space-y-4 p-5">
                {activeTab === "details" && (
              <>
                {/* Schedule */}
                <div className="flex flex-col gap-4">
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
                        const hasSecondaryScheduleContent =
                          outsideHours
                          || Boolean(scheduleTimeRange)
                          || scheduleAssignments.length > 0
                          || !isSinglePersonCompany;

                        const scheduleDate = new Date(schedule.scheduled_date + "T00:00:00");
                        const scheduleDateLabel = format(scheduleDate, "EEE, MMM d");
                        const scheduleCardContent = (
                          <div className={cn("flex justify-between gap-2", hasSecondaryScheduleContent ? "items-start" : "items-center")}>
                            <div className={cn("flex min-w-0 flex-1 gap-3", hasSecondaryScheduleContent ? "items-start" : "items-center")}>
                              <MonthDayDateBadge date={scheduleDate} />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-1 md:text-2 font-semibold leading-tight text-foreground">
                                    {scheduleDateLabel}
                                  </p>
                                </div>
                                {outsideHours && (
                                  <Badge variant="outline" className="text-base border-orange-500 text-orange-700 dark:text-orange-400">
                                    Outside normal hours
                                  </Badge>
                                )}

                                {scheduleTimeRange && (
                                  <p className="mt-0.5 text-base md:text-sm text-muted-foreground">
                                    {scheduleTimeRange}
                                  </p>
                                )}
                                {scheduleAssignments.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {scheduleAssignments.map((assignment) => (
                                      <Badge key={assignment.id} variant="outline" className="text-base text-muted-foreground py-0">
                                        {assignment.profiles?.full_name || "Unknown"}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : !isSinglePersonCompany ? (
                                  <p className="mt-0.5 text-base md:text-sm text-muted-foreground">
                                    No crew assigned
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {isManager() && (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground">
                                <Edit className="h-5 w-5 md:h-4 md:w-4" />
                              </div>
                            )}
                          </div>
                        );

                        return isManager() ? (
                          <button
                            key={schedule.id}
                            type="button"
                            onClick={() => openEditCrewDialog(schedule.id)}
                            className="w-full rounded-xl text-left transition-colors hover:bg-muted/40 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label={`${isSinglePersonCompany ? "Edit schedule" : "Edit schedule and crew"} for ${scheduleDateLabel}`}
                          >
                            {scheduleCardContent}
                          </button>
                        ) : (
                          <div key={schedule.id} className="rounded-xl">
                            {scheduleCardContent}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="flex items-center p-2 bg-secondary/50 rounded-md">
                        <p className="text-base font-medium text-muted-foreground">
                          No date scheduled
                        </p>
                      </div>
                    </div>
                  )}
                       {isManager() && !jobAny.recurring_job_id && (
                          <Button
                            variant="outline"
                            size="lg"

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
                        <p className="text-base text-muted-foreground mt-0.5">
                          {recurringJobData.frequency === "weekly" && "Every week"}
                          {recurringJobData.frequency === "biweekly" && "Every 2 weeks"}
                          {recurringJobData.frequency === "monthly" && "Every month"}
                          {recurringJobData.end_date
                            ? ` until ${format(new Date(recurringJobData.end_date + "T00:00:00"), "MMM d, yyyy")}`
                            : " (ongoing)"}
                        </p>
                        <p className="text-base text-muted-foreground mt-0.5">
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
                            <DropdownMenuItem className="text-base" onClick={(e) => {
                              e.stopPropagation();
                              setEditScheduleOpen(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-base" onClick={(e) => {
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
                              className="text-base text-destructive focus:text-destructive"
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
                        <p className="text-base text-foreground mt-0.5">
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
                <div className="hidden gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    1. log your hours
                  </p>
                </div>
                <div>
                  <JobTimeTracker
                    jobId={id}
                    jobAddress={clientAddress || null}
                    accountId={currentAccount?.id}
                    embedded
                  />
                </div>
                <div className="h-0" />
                
                <div className="hidden py-4">
                  <Separator />
                </div>

                <div className="hidden gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    2. checklist items
                  </p>
                </div>
                <div>
                  <JobChecklist
                    jobId={id}
                    jobStatus={job?.status}
                    isEstimateVisit={job?.is_estimate_visit}
                    clientPortalUrl={portalLink || null}
                    customerPhone={job?.customer?.phone}
                    isTwilioConfigured={isTwilioConfigured}
                    isManager={isManager()}
                    hasBeforePhotos={hasBeforePhotos}
                    embedded
                    onGoToDetailsTab={() => setActiveTab("details")}
                    scanReceiptSignal={scanReceiptSignal}
                    onMarkComplete={async () => {
                      if (job?.is_estimate_visit) {
                        const waitForConvertedJob = async () => {
                          const timeoutMs = 10000;
                          const pollMs = 300;
                          const startedAt = Date.now();

                          while (Date.now() - startedAt < timeoutMs) {
                            const { data: convertedJob, error: convertedJobError } = await supabase
                              .from("leads")
                              .select("*")
                              .eq("estimate_job_id", id)
                              .eq("is_estimate_visit", false)
                              .order("created_at", { ascending: false })
                              .limit(1)
                              .maybeSingle();

                            if (convertedJobError) {
                              throw convertedJobError;
                            }

                            if (convertedJob) {
                              return convertedJob;
                            }

                            await new Promise((resolve) => setTimeout(resolve, pollMs));
                          }

                          return null;
                        };

                        const { error: conversionError } = await supabase.rpc("try_convert_lead_to_job", {
                          p_lead_id: id!,
                        });

                        if (conversionError) {
                          throw conversionError;
                        }

                        const newJob = await waitForConvertedJob();

                        if (newJob) {
                          queryClient.invalidateQueries({ queryKey: ["jobs"] });
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          toast.success("Job created from estimate visit!");
                          navigate(`/jobs/${newJob.id}`);
                        } else {
                          queryClient.invalidateQueries({ queryKey: ["jobs"] });
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          throw new Error("This estimate visit did not complete. Please try again.");
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

                        try {
                          triggerJobCompletionAutomation({ id: id!, name: (job as any)?.name, service_type: (job as any)?.service_type, scheduled_date: (job as any)?.scheduled_date, scheduled_time_start: (job as any)?.scheduled_time_start });
                        } catch (automationError) {
                          console.error("Job completion automation failed:", automationError);
                        }

                        try {
                          await sendCompletionReviewRequest({ openPortalDialogOnFallback: false });
                        } catch (reviewError) {
                          console.error("Failed to send completion review request:", reviewError);
                          toast.error("Job completed, but the review request could not be sent automatically.");
                        }

                        await queryClient.invalidateQueries({ queryKey: ["job", id] });
                        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
                        await queryClient.invalidateQueries({ queryKey: ["leads"] });
                      }
                    }}
                  />
                </div>

              </>
            )}

            {activeTab === "photos" && id && (
              <>
                <PhotoSection
                  leadId={job?.is_estimate_visit && parentLeadId ? parentLeadId : id}
                  photoType="before"
                  title="Before"
                  onPhotosChange={() => fetchBeforePhotos()}
                  onJobConverted={handleJobConverted}
                  embedded
                />
                {!job?.is_estimate_visit && (
                  <PhotoSection
                    leadId={id}
                    photoType="after"
                    title="After"
                    onPhotosChange={() => fetchAfterPhotos()}
                    embedded
                  />
                )}
              </>
            )}

            {activeTab === "documents" && id && (
              <>
                <JobDocumentsSection
                  leadId={job?.is_estimate_visit && parentLeadId ? parentLeadId : id}
                  estimateId={displayEstimate?.id || null}
                  estimateStatus={typeof displayEstimate?.status === "string" ? displayEstimate.status : null}
                  estimateHasPendingChanges={displayEstimate?.has_pending_changes === true}
                  onViewEstimate={
                    displayEstimate?.id ? () => navigate(`/payments/estimates/${displayEstimate.id}`) : undefined
                  }
                  onBuildEstimate={
                    !displayEstimate && !estimateLoading ? () => void openBuildEstimateModal() : undefined
                  }
                  accountId={currentAccount?.id}
                  userId={user?.id}
                  estimateAgreementTemplates={
                    displayEstimate?.agreement_templates && typeof displayEstimate.agreement_templates === "object"
                      ? (displayEstimate.agreement_templates as Record<string, unknown>)
                      : null
                  }
                  templateMergeFields={{
                    current_date: format(new Date(), "yyyy-MM-dd"),
                    job_name: job?.name || "",
                    job_address: [job?.address, job?.city].filter(Boolean).join(", "),
                    service_type: typeof job?.service_type === "string" && job.service_type.trim() ? job.service_type : "Other",
                    client_name: job?.customer?.name || "",
                    client_email: job?.customer?.email || "",
                    client_phone: job?.customer?.phone || "",
                    company_name: currentAccount?.company_name || "",
                    company_email: currentAccount?.company_email || "",
                    company_phone: currentAccount?.company_phone || "",
                    estimate_total: displayEstimate?.total ?? "",
                    estimate_subtotal: displayEstimate?.subtotal ?? "",
                    estimate_tax: displayEstimate?.tax ?? "",
                    estimate_discount: displayEstimate?.discount ?? "",
                    default_payment_schedule: defaultPaymentScheduleSummary,
                    default_payment_deposit_percentage: formatPaymentSchedulePercent(defaultPaymentSchedule.deposit),
                    default_payment_midpoint_percentage: formatPaymentSchedulePercent(defaultPaymentSchedule.midpoint),
                    default_payment_final_percentage: formatPaymentSchedulePercent(defaultPaymentSchedule.final),
                    scope_of_work: scopeOfWorkFromTasks,
                  }}
                />

                <div className="py-1">
                  <Separator />
                </div>

                <div>
                  <MentionInput
                    value={newNote}
                    onChange={setNewNote}
                    placeholder="Add a note... (use @ to mention team members)"
                    rows={2}
                    teamMembers={teamMembers}
                    textareaClassName="text-base md:text-sm"
                  />
                  <Button
                    variant="outline"
                    size="lg"
                    className="mt-3 text-base md:h-8 md:px-3 md:py-1.5 md:text-xs"
                    onClick={addNote}
                    disabled={!newNote.trim() || addingNote}
                  >
                    <Plus className="h-5 w-5 md:h-4 md:w-4 mr-1" /> Add Note
                  </Button>
                </div>

                {notes.length > 0 ? (
                  <div className="space-y-3 flex flex-col gap-4">
                    {notes.map((note) => (
                      <div key={note.id} className="flex gap-4 py-3 border-b last:border-b-0">
                        <div className="flex-shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-full bg-secondary flex items-center justify-center">
                          <FileText className="h-5 w-5 md:h-4 md:w-4" />
                        </div>

                        <div className="flex-1 items-center justify-between gap-2 mb-0.5">
                          <p className="text-xl md:text-base whitespace-pre-wrap">
                            {parseMentionsForDisplay(note.body || note.summary || "").map((part, idx) =>
                              part.type === "mention" ? (
                                <span key={idx} className="font-bold text-primary">@{part.content}</span>
                              ) : (
                                <span key={idx}>{part.content}</span>
                              )
                            )}
                          </p>

                          <span className="text-base md:text-xs text-muted-foreground ml-auto">
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

          {isMobile ? (
            <>
              {id && (
                <div className="hidden">
                  <JobCosts
                    jobId={id}
                    grouped
                    openSignal={viewCostsSignal}
                    addSignal={addCostsSignal}
                    onEstimateApproved={fetchEstimate}
                  />
                </div>
              )}
              {isManager() && id && isAcceptedEstimate && (
                <div className="hidden">
                  <JobInvoiceCard
                    jobId={id}
                    customerEmail={job.customer?.email}
                    customerName={job.customer?.name}
                    estimateTotal={displayEstimate?.total ? Number(displayEstimate.total) : null}
                    openLogPaymentSignal={openLogPaymentSignal}
                    grouped
                  />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4" data-testid="job-details-right-column">
              {/* Estimate / Quote */}
              {displayEstimate ? (
                <DetailEstimateCard
                  label={jobAny.recurring_job_id ? "Quote" : "Estimate"}
                  status={String(displayEstimate.status || "draft")}
                  total={estimateCardTotal}
                  lineItemCount={displayEstimate.line_items?.length || 0}
                  showStartingAt={hasMultipleEstimateVersions && !isAcceptedEstimate}
                  onClick={() => navigate(`/payments/estimates/${displayEstimate.id}`)}
                />
              ) : !estimateLoading ? (
                <div className="rounded-lg border border-dashed border-border bg-card p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">No estimate available</p>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => void openBuildEstimateModal()}
                  >
                    <DollarSign className="h-4 w-4" />
                    Build Estimate
                  </Button>
                </div>
              ) : null}

              {/* Job Costs */}
              {id && (
                <JobCosts
                  jobId={id}
                  openSignal={viewCostsSignal}
                  addSignal={addCostsSignal}
                  onEstimateApproved={fetchEstimate}
                />
              )}

              {/* Invoices Section */}
              {isManager() && id && isAcceptedEstimate && (
                <JobInvoiceCard
                  jobId={id}
                  customerEmail={job.customer?.email}
                  customerName={job.customer?.name}
                  estimateTotal={displayEstimate?.total ? Number(displayEstimate.total) : null}
                  openLogPaymentSignal={openLogPaymentSignal}
                />
              )}
            </div>
          )}
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
          jobSchedules={schedules}
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

      <Dialog open={editCostsMenuOpen} onOpenChange={setEditCostsMenuOpen}>
        <DialogContent className="max-w-sm border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => {
                setEditCostsMenuOpen(false);
                setActiveTab("checklist");
                setScanReceiptSignal((value) => value + 1);
              }}
            >
              <ScanLine className="h-4 w-4" />
              Scan receipt
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => {
                setEditCostsMenuOpen(false);
                setActiveTab("details");
                setAddCostsSignal((value) => value + 1);
              }}
            >
              <Plus className="h-4 w-4" />
              Add cost
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => {
                setEditCostsMenuOpen(false);
                setActiveTab("details");
                setViewCostsSignal((value) => value + 1);
              }}
            >
              <FileText className="h-4 w-4" />
              View costs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClientPortalLinkDialog
        open={portalDialogOpen}
        onOpenChange={setPortalDialogOpen}
        portalLink={portalLink}
        copied={portalCopied}
        onCopy={handleCopyPortalLink}
        onTextClient={handleTextPortalLink}
        onEmailClient={handleEmailPortalLink}
        emailSending={portalEmailSending}
        emailSent={portalEmailSent}
        clientPhone={portalClientPhone || job.customer?.phone || ""}
        clientEmail={portalClientEmail || job.customer?.email || ""}
        portalSentAt={estimate?.sent_at || null}
        portalViewedAt={portalLastViewedAt || estimate?.viewed_at || null}
      />

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
              Update job and customer information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-customer-name">Customer Name</Label>
                <Input
                  id="edit-customer-name"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-phone">Customer Phone</Label>
                <Input
                  id="edit-customer-phone"
                  type="tel"
                  value={editForm.customer_phone}
                  onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-customer-email">Customer Email</Label>
              <Input
                id="edit-customer-email"
                type="email"
                value={editForm.customer_email}
                onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-customer-address">Customer Address</Label>
                <Input
                  id="edit-customer-address"
                  value={editForm.customer_address}
                  onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-city">Customer City</Label>
                <Input
                  id="edit-customer-city"
                  value={editForm.customer_city}
                  onChange={(e) => setEditForm({ ...editForm, customer_city: e.target.value })}
                  placeholder="Austin"
                />
              </div>
            </div>
            <Separator />
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
              <ServiceTypeSelect
                id="edit-service-type"
                value={editForm.service_type}
                onValueChange={(v) => setEditForm({ ...editForm, service_type: v })}
                options={serviceTypeOptions}
              />
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
            <Button onClick={handleEdit} disabled={updateJobMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive / Mark as Cancelled Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {job?.status === "completed" || job?.status === "paid" ? "Archive Job" : "Mark as Canceled"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {job?.status === "completed" || job?.status === "paid"
                ? `This will archive "${job?.name || "this job"}" and send it to the archive. You can restore it later from the Archive section on the Leads page.`
                : `This will mark "${job?.name || "this job"}" as canceled and send it to the archive. You can restore it later from the Archive section on the Leads page.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={archiveJob}>
              {job?.status === "completed" || job?.status === "paid" ? "Archive" : "Mark as Canceled"}
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
            <DialogTitle>{isSinglePersonCompany ? "Edit Schedule" : "Edit Crew"}</DialogTitle>
            <DialogDescription>
              {isSinglePersonCompany
                ? "Update this scheduled date or assigned-state override."
                : "Update this scheduled date, crew assignment, or assigned-state override."}
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

            <div className="rounded-md border bg-muted p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="edit-mark-assigned"
                  checked={editingSuppressUnassigned}
                  disabled={editingCrewUserIds.length > 0}
                  onCheckedChange={(value) => toggleEditingSuppressUnassigned(value === true)}
                />
                <div>
                  <Label
                    htmlFor="edit-mark-assigned"
                    className={cn(
                      "text-sm font-semibold",
                      editingCrewUserIds.length > 0 ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                    )}
                  >
                    Mark as assigned
                  </Label>
                </div>
              </div>
            </div>

            {!isSinglePersonCompany && (
              <>
                {teamMembers.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto border rounded-md">
                    {teamMembers.map((member) => {
                      const memberId = `edit-crew-${member.user_id}`;
                      const isSelected = editingCrewUserIds.includes(member.user_id);
                      return (
                        <div
                          key={member.user_id}
                          className={cn(
                            "flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0",
                            editingSuppressUnassigned && "opacity-60",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={memberId}
                              checked={isSelected}
                              disabled={editingSuppressUnassigned}
                              onCheckedChange={() => toggleEditingCrewUser(member.user_id)}
                            />
                            <Label
                              htmlFor={memberId}
                              className={cn(
                                "text-sm font-normal leading-none",
                                editingSuppressUnassigned ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                              )}
                            >
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
              </>
            )}
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
          onMakeOneOffInstead={() => {
            setMakeRecurringOpen(false);
            setScheduleDialogOpen(true);
          }}
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

      <FloatingActionButton actions={mobileQuickActions} className="md:hidden" triggerIcon="wrench" />

      <MobileNav />
    </div>
  );
}
