import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EllipsisVertical, Phone, MessageSquare, Calendar, Plus, Briefcase, TriangleAlert as AlertTriangle, Check, X, Clock, FileText, PhoneCall, MessageCircle, User, Trash2, Pencil as Edit, DollarSign, ChevronRight, ChevronDown, Info, MapPin, Mail, Navigation, Archive, FileText as FileTextIcon, Trophy, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClientShareLink } from "@/components/jobs/ClientShareLink";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreateEstimateDialog } from "@/components/leads/CreateEstimateDialog";
import { LineItemsEstimateDialog, type EstimateLineItemInit } from "@/components/leads/LineItemsEstimateDialog";
import { supabase } from "@/integrations/supabase/client";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { SpeechToTextTextarea } from "@/components/ui/speech-to-text-textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDetailDeleteConfig } from "@/lib/detailDeleteConfig";
import { openMapsWithAddress } from "@/lib/openMaps";
import { useAuth } from "@/hooks/useAuth";
import { useCreateJob } from "@/hooks/useJobs";
import { useDeleteLead } from "@/hooks/useLeads";
import { format } from "date-fns";

import { useQueryClient } from "@tanstack/react-query";
import { Database } from "@/types/database";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { MentionInput } from "@/components/ui/mention-input";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { parseMentionsForDisplay, parseMentionsToHTML } from "@/lib/mentionParser";
import { formatCurrency } from "@/lib/formatter";
import { DetailEstimateCard } from "@/components/shared/DetailEstimateCard";
import { getEstimateCardTotal } from "@/lib/estimateCardTotals";
import { getInteractionPostLabel, getInteractionPostUrl } from "@/lib/interactionPostLink";

type LeadStatus = Database["public"]["Enums"]["lead_status"];
type InteractionType = Database["public"]["Enums"]["interaction_type"];
type InteractionDirection = Database["public"]["Enums"]["interaction_direction"];
type TimelinePeriod = Database["public"]["Enums"]["timeline_period"];
type DisqualifyReason = Database["public"]["Enums"]["disqualify_reason"];

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  service_type: string | null;
  city: string | null;
  address: string | null;
  estimated_value: number | null;
  source: string | null;
  status: LeadStatus;
  qualification_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  estimate_job_id: string | null;
  customer_id?: string | null;
}

interface Interaction {
  id: string;
  lead_id: string;
  type: InteractionType;
  direction: InteractionDirection;
  summary: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

interface Qualification {
  id: string;
  lead_id: string;
  budget_confirmed: boolean;
  service_area_fit: boolean;
  decision_maker_confirmed: boolean;
  timeline: TimelinePeriod | null;
  fit_score?: number;
  disqualify_reason: DisqualifyReason | null;
  notes: string | null;
}

const CHECKLIST_MARKDOWN_LINE_REGEX = /^\s*[-*]\s+\[(?:\s|x|X)\]\s+/;

function stripChecklistMarkdownLines(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => !CHECKLIST_MARKDOWN_LINE_REGEX.test(line))
    .join("\n")
    .trim();
}

function getInteractionDisplayBody(interaction: Interaction): string {
  const rawText = interaction.body || interaction.summary || "";
  const postUrl = getInteractionPostUrl(
    interaction.metadata,
    interaction.body,
    interaction.summary,
  );

  // Posted interactions can include automation checklist markdown that should stay hidden in the UI.
  if (!postUrl) return rawText;

  const sanitized = stripChecklistMarkdownLines(rawText);
  if (sanitized) return sanitized;

  return stripChecklistMarkdownLines(interaction.summary) || "";
}

const PIPELINE_STAGES: { value: string; label: string; color: string, bg_color: string}[] = [
  { value: "new", label: "New", color: "text-status-progress", bg_color: "status-progress-bg"},
  { value: "contacted", label: "Contacted", color: "text-status-progress",  bg_color: "status-progress-bg"},
  { value: "qualified", label: "Qualified", color: "text-status-progress",  bg_color: "status-progress-bg" },
  { value: "job", label: "Job", color: "text-status-progress",  bg_color: "status-progress-bg" },
];

const LEAD_STATUS_GUIDANCE = [
  {
    value: "new",
    label: "New",
    description: "A fresh lead that has been created or imported and has not been worked yet.",
    requirement: "Create the lead record to place it in this stage.",
  },
  {
    value: "contacted",
    label: "Contacted",
    description: "The lead has received initial outreach or has already replied.",
    requirement: "Reach out by call, text, or email. Then mark the lead as contacted.",
  },
  {
    value: "qualified",
    label: "Qualified",
    description: "The lead is a real fit for the business and ready for an estimate or next sales step.",
    requirement: "Confirm budget, service fit, timeline, and decision-maker readiness. Then mark the lead as qualified.",
  },
  {
    value: "job",
    label: "Job",
    description: "The lead has moved out of the sales pipeline and into active work.",
    requirement: "Get the lead qualified, make sure you have added the address and city of the lead, then press the Schedule Vist button",
  },
  {
    value: "lost",
    label: "Lost",
    description: "The lead is no longer active and should be treated as archived.",
    requirement: "Press the three dots in the card header and select Mark As Lost",
  },
] as const;

const TIMELINE_OPTIONS: { value: TimelinePeriod; label: string }[] = [
  { value: "asap", label: "ASAP" },
  { value: "1_2_weeks", label: "1-2 weeks" },
  { value: "2_4_weeks", label: "2-4 weeks" },
  { value: "1_3_months", label: "1-3 months" },
  { value: "3_months_plus", label: "3+ months" },
];

const DISQUALIFY_REASONS: { value: DisqualifyReason; label: string }[] = [
  { value: "low_budget", label: "Low Budget" },
  { value: "outside_area", label: "Outside Service Area" },
  { value: "not_ready", label: "Not Ready" },
  { value: "price_shopping", label: "Price Shopping" },
  { value: "ghosted", label: "Ghosted" },
  { value: "other", label: "Other" },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const createJobMutation = useCreateJob();
  const deleteLeadMutation = useDeleteLead();

  const { scheduleJob, isScheduling } = useScheduleJob();

  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [statusGuidanceOpen, setStatusGuidanceOpen] = useState(false);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const estimateVersions = Array.isArray(estimate?.versions) ? estimate.versions : [];
  const hasMultipleEstimateVersions = estimateVersions.length > 1;
  const isAcceptedEstimate = String(estimate?.status || "") === "accepted";
  const estimateCardTotal = getEstimateCardTotal(estimate);

  // New note state
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const { data: teamMembers = [] } = useTeamMembers();

  // Activity timeline state
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Qualification state
  const [qualNotes, setQualNotes] = useState("");
  const [savingQual, setSavingQual] = useState(false);

  // Disqualify dialog
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState<DisqualifyReason | null>(null);

  // Mark as lost dialog
  const [markLostDialogOpen, setMarkLostDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    service_type: "",
    address: "",
    city: "",
    estimated_value: "",
  });
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");

  // Create estimate dialog
  const [createEstimateDialogOpen, setCreateEstimateDialogOpen] = useState(false);

  // Line items estimate dialog
  const [lineItemsDialogOpen, setLineItemsDialogOpen] = useState(false);

  // Convert to job dialog with optional scheduling
  const [convertJobDialogOpen, setConvertJobDialogOpen] = useState(false);
  const [convertingJob, setConvertingJob] = useState(false);
  const [jobSchedule, setJobSchedule] = useState({
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: ""
  });

  const deleteLeadConfig = getDetailDeleteConfig({
    entity: "lead",
    name: lead?.name || "this lead",
  });

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchInteractions();
      fetchQualification();
      checkEstimate();
    }
  }, [id]);

  const fetchLead = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, customer:customers!customer_id(id, name, email, phone, address, city)")
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      const leadData = data as any;
      setCustomer(leadData.customer || null);
      setLead({
        ...leadData,
        name: leadData.customer?.name || leadData.name,
        phone: leadData.customer?.phone || leadData.phone,
        email: leadData.customer?.email || leadData.email,
        address: leadData.customer?.address || leadData.address,
        city: leadData.customer?.city || leadData.city,
        customer: undefined,
      });
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    if (data) {
      setInteractions(data as Interaction[]);
    }
  };

  const fetchQualification = async () => {
    const { data } = await supabase
      .from("lead_qualifications")
      .select("*")
      .eq("lead_id", id)
      .maybeSingle();

    if (data) {
      setQualification(data as Qualification);
      setQualNotes(data.notes || "");
    }
  };

  const checkEstimate = async () => {
    if (!id) return;

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

    const buildEstimateQuery = () =>
      supabase
        .from("estimates")
        .select("id, total, status, line_items:estimate_line_items(id), versions:estimate_versions(id, total)")
        .eq("job_id", id);

    const acceptedQuery = buildEstimateQuery().eq("status", "accepted");
    const { data: acceptedEstimate, error: acceptedError } = await latestOnly(acceptedQuery).maybeSingle();
    if (acceptedError) {
      console.error("Failed to load accepted estimate:", acceptedError);
      setHasEstimate(false);
      setEstimate(null);
      return;
    }

    if (acceptedEstimate) {
      setHasEstimate(true);
      setEstimate(acceptedEstimate);
      return;
    }

    const { data: latestEstimate, error: latestError } = await latestOnly(buildEstimateQuery()).maybeSingle();
    if (latestError) {
      console.error("Failed to load latest estimate:", latestError);
      setHasEstimate(false);
      setEstimate(null);
      return;
    }

    setHasEstimate(!!latestEstimate);
    setEstimate(latestEstimate ?? null);
  };

  const updateLeadStatus = async (newStatus: string) => {
    if (!lead) return;

    if (newStatus === "scheduled") {
      toast.info("To set status to Scheduled, convert this lead to a job and add a scheduled date in the future.");
      return;
    }

    if (newStatus === "in_progress") {
      toast.info("To set status to In Progress, convert this lead to a job with a scheduled date that is today or in the past.");
      return;
    }

    if (newStatus === "job") {
      if (lead.status !== "qualified") {
        toast.error("Lead must be qualified before converting to Job");
        return;
      }
      if (!hasEstimate) {
        toast.error("Please create an estimate first");
        setCreateEstimateDialogOpen(true);
        return;
      }
      if (estimate?.status !== "accepted") {
        toast.error("The estimate must be approved before converting to a job");
        return;
      }
      setConvertJobDialogOpen(true);
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus as LeadStatus })
      .eq("id", lead.id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    // Log interaction for status change
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      account_id: currentAccount?.id,
      type: "status_change" as InteractionType,
      direction: "na" as InteractionDirection,
      summary: `Status changed to ${newStatus}`,
      created_by: user?.id,
    });

    setLead({ ...lead, status: newStatus as LeadStatus });
    fetchInteractions();
    toast.success(`Status updated to ${newStatus}`);
  };

  const addNote = async () => {
    if (!newNote.trim() || !lead) return;

    setAddingNote(true);

    const { error } = await supabase.from("interactions").insert({
      lead_id: lead.id,
      account_id: currentAccount?.id,
      type: "note" as InteractionType,
      direction: "na" as InteractionDirection,
      body: newNote,
      summary: newNote.slice(0, 100),
      created_by: user?.id,
    });

    if (error) {
      toast.error("Failed to add note");
    } else {
      setNewNote("");
      fetchInteractions();
      toast.success("Note added");
    }
    setAddingNote(false);
  };

  const logCall = async (direction: "inbound" | "outbound") => {
    if (!lead) return;

    await supabase.from("interactions").insert({
      lead_id: lead.id,
      account_id: currentAccount?.id,
      type: "call" as InteractionType,
      direction: direction as InteractionDirection,
      summary: `${direction === "outbound" ? "Outgoing" : "Incoming"} call`,
      metadata: { phone: lead.phone },
      created_by: user?.id,
    });

    fetchInteractions();
  };

  const logText = async () => {
    if (!lead) return;

    await supabase.from("interactions").insert({
      lead_id: lead.id,
      account_id: currentAccount?.id,
      type: "text" as InteractionType,
      direction: "outbound" as InteractionDirection,
      summary: "Text message sent",
      metadata: { phone: lead.phone },
      created_by: user?.id,
    });

    fetchInteractions();
  };

  const calculateFitScore = (qual: Qualification | null): number => {
    if (!qual) return 0;

    let fitScore = 0;
    if (qual.budget_confirmed) fitScore += 30;
    if (qual.service_area_fit) fitScore += 30;
    if (qual.decision_maker_confirmed) fitScore += 25;
    if (qual.timeline === "asap" || qual.timeline === "1_2_weeks") fitScore += 15;
    else if (qual.timeline === "2_4_weeks") fitScore += 10;
    else if (qual.timeline === "1_3_months") fitScore += 5;

    if (lead.status === "qualified") fitScore=100;
    
    return fitScore;
  };

  const updateQualification = async (updates: Partial<Qualification>) => {
    if (!currentAccount) {
      toast.error("Account not found");
      return;
    }

    setSavingQual(true);

    const payload = {
      ...updates,
      lead_id: id,
      account_id: currentAccount.id,
    };

    try {
      if (qualification) {
        const { error } = await supabase
          .from("lead_qualifications")
          .update(payload)
          .eq("id", qualification.id);

        if (error) {
          console.error("Error updating qualification:", error);
          toast.error("Failed to update qualification");
          setSavingQual(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from("lead_qualifications")
          .insert(payload);

        if (error) {
          console.error("Error creating qualification:", error);
          toast.error("Failed to create qualification");
          setSavingQual(false);
          return;
        }
      }

      await fetchQualification();
      setSavingQual(false);
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An error occurred");
      setSavingQual(false);
    }
  };

  const markQualified = async () => {
    await updateLeadStatus("qualified");
    toast.success("Lead marked as qualified! Consider booking or creating a job.");
  };

  const handleDisqualify = async () => {
    if (!disqualifyReason || !lead) {
      toast.error("Please select a reason");
      return;
    }

    await updateQualification({ disqualify_reason: disqualifyReason });

    // Move lead to lost/archived so it appears in Archive section only
    const { error } = await supabase
      .from("leads")
      .update({ status: "lost" as LeadStatus })
      .eq("id", lead.id);

    if (!error) {
      setLead({ ...lead, status: "lost" as LeadStatus });
      await supabase.from("interactions").insert({
        lead_id: lead.id,
        account_id: currentAccount?.id,
        type: "status_change" as InteractionType,
        direction: "na" as InteractionDirection,
        summary: `Lead disqualified: ${disqualifyReason}`,
        created_by: user?.id,
      });
      fetchInteractions();
    }

    setDisqualifyOpen(false);
    toast.success("Lead disqualified and moved to archive");
  };

  const handleEstimateSuccess = () => {
    fetchLead();
    checkEstimate();
  };

  const hasAddress = !!(lead?.address && lead.address.trim() && lead?.city && lead.city.trim());

  const convertToJob = async () => {
    if (!lead || !hasEstimate) {
      toast.error("An estimate is required to convert to job");
      return;
    }
    if (estimate?.status !== "accepted") {
      toast.error("The estimate must be approved before converting to a job");
      return;
    }

    setConvertingJob(true);
    const loadingToast = toast.loading("Converting to job...");

    try {
      // If a schedule date is provided, try scheduling first. If it fails, abort conversion.
      if (jobSchedule.scheduled_date) {
        const scheduled = await scheduleJob({
          leadId: lead.id,
          scheduledDate: jobSchedule.scheduled_date,
          startTime: jobSchedule.scheduled_time_start,
          endTime: jobSchedule.scheduled_time_end,
        });

        if (!scheduled.ok) {
          toast.dismiss(loadingToast);
          setConvertingJob(false);
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: "job",
        })
        .eq("id", lead.id);

      if (updateError) throw new Error("Failed to update job status");

      if (lead.estimate_job_id) {
        await supabase
          .from("leads")
          .update({ status: "completed" })
          .eq("id", lead.estimate_job_id);
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        account_id: currentAccount?.id,
        type: "status_change" as InteractionType,
        direction: "na" as InteractionDirection,
        summary: "Converted to job",
        created_by: user?.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Lead converted to job successfully!");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });

      setConvertJobDialogOpen(false);
      navigate(`/jobs/${lead.id}`);
    } catch (error) {
      console.error("Error converting to job:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to convert to job");
    } finally {
      setConvertingJob(false);
    }
  };

  const openEditDialog = () => {
    if (!lead) return;
    setEditForm({
      name: lead.name,
      phone: lead.phone || "",
      email: lead.email || "",
      service_type: lead.service_type || "",
      address: lead.address || "",
      city: lead.city || "",
      estimated_value: lead.estimated_value?.toString() || "",
    });
    setEditDialogOpen(true);
  };

  const saveLead = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      if (customer?.id) {
        const { error: customerError } = await supabase
          .from("customers")
          .update({
            name: editForm.name,
            phone: editForm.phone || null,
            email: editForm.email || null,
            address: editForm.address || null,
            city: editForm.city || null,
          })
          .eq("id", customer.id);

        if (customerError) throw customerError;
      }

      const { error } = await supabase
        .from("leads")
        .update({
          name: editForm.name,
          phone: editForm.phone || null,
          email: editForm.email || null,
          service_type: editForm.service_type || null,
          address: editForm.address || null,
          city: editForm.city || null,
          estimated_value: editForm.estimated_value ? parseFloat(editForm.estimated_value) : null,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead updated successfully");
      setEditDialogOpen(false);
      fetchLead();
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  const markAsLost = async () => {
    if (!lead?.id) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "lost" })
        .eq("id", lead.id);

      if (error) throw error;

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        account_id: currentAccount?.id,
        type: "status_change" as InteractionType,
        direction: "na" as InteractionDirection,
        summary: "Marked as lost and sent to archive",
        created_by: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
      queryClient.invalidateQueries({ queryKey: ["archived-leads"] });
      toast.success("Lead marked as lost");
      navigate("/leads");
    } catch (error) {
      console.error("Error marking lead as lost:", error);
      toast.error("Failed to mark lead as lost");
    } finally {
      setMarkLostDialogOpen(false);
    }
  };

  const deleteLead = async () => {
    if (!lead?.id) return;

    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      toast.success(deleteLeadConfig.successMessage);
      navigate(deleteLeadConfig.redirectPath);
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const getInteractionIcon = (type: InteractionType) => {
    switch (type) {
      case "call": return <PhoneCall className="h-4 w-4" />;
      case "text": return <MessageCircle className="h-4 w-4" />;
      case "note": return <FileText className="h-4 w-4" />;
      case "status_change": return <Clock className="h-4 w-4" />;
      case "booking": return <Calendar className="h-4 w-4" />;
      case "system": return <User className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadgeStatus = (status: LeadStatus) => {
    switch (status) {
      case "qualified":
      case "job":
        return "confirmed";
      case "lost":
        return "attention";
      case "new":
      case "contacted":
        return "pending";
      case "paid":
      case "completed":
        return "confirmed";
      default:
        return "pending";
    }
  };

  const getLeadStatusLabel = (status: LeadStatus) => {
    const override = LEAD_STATUS_GUIDANCE.find((stage) => stage.value === status);
    if (override) return override.label;

    return status
      .split(/[\s_-]+/)
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : ""
      )
      .join(" ");
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "No phone";

    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return trimmed;

    // Separate an optional country code from the last 10 local digits.
    const hasCountryCode = digits.length > 10;
    const countryCode = hasCountryCode ? digits.slice(0, digits.length - 10) : "";
    const area = digits.slice(-10, -7);
    const prefix = digits.slice(-7, -4);
    const line = digits.slice(-4);

    if (digits.length >= 10) {
      const localFormatted = `(${area}) ${prefix}-${line}`;
      return countryCode ? `+${countryCode} ${localFormatted}` : localFormatted;
    }

    if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

    // Fallback to original text when we can't confidently format.
    return trimmed;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Lead Not Found" showBack backTo="/leads" />
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Lead Not Found</h2>
          <p className="text-muted-foreground text-center mb-6">
            This lead may have been deleted or you don't have access to it.
          </p>
          <Button onClick={() => navigate("/leads")}>
            Return to Leads
          </Button>
        </div>
        <MobileNav />
      </div>
    );
  }

  const showConvertButton = lead.status === "qualified";
  const showBuildEstimateAction = !["job", "paid", "completed"].includes(lead.status) && !hasEstimate;
  const isEstimateApproved = estimate?.status === "accepted";
  const scheduleVisitDisabledReason = !hasAddress ? "Add an address and city to schedule a visit." : null;
  const contentTabs: { id: typeof activeTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "notes", label: "Notes" },
  ];
  const statusSteps = PIPELINE_STAGES.map((stage) => ({ key: stage.value, label: stage.label }));
  const currentStepKey = (() => {
    if (["job", "paid", "completed"].includes(lead.status)) return "job";
    if (lead.status === "qualified") return "qualified";
    if (lead.status === "contacted") return "contacted";
    return "new";
  })();
  const currentStepIndex = Math.max(statusSteps.findIndex((step) => step.key === currentStepKey), 0);
  const recentActivity = interactions.slice(0, 3);
  const clientAddress = [lead.address, lead.city].filter(Boolean).join(", ");

  const getPhoneUriValue = (phone: string | null): string => {
    if (!phone) return "";

    const trimmed = phone.trim();
    if (!trimmed) return "";

    const normalized = trimmed.startsWith("+")
      ? `+${trimmed.slice(1).replace(/\D/g, "")}`
      : trimmed.replace(/\D/g, "");

    return normalized;
  };

  const normalizedPhone = getPhoneUriValue(lead.phone);
  const callHref = normalizedPhone ? `tel:${normalizedPhone}` : "";
  const textHref = normalizedPhone ? `sms:${normalizedPhone}` : "";

  const handleNavigate = () => {
    if (clientAddress) {
      openMapsWithAddress(clientAddress);
    }
  };

  const handleCall = () => {
    if (!callHref) return;
    window.open(callHref);
    void logCall("outbound");
  };

  const handleText = () => {
    if (!textHref) return;
    window.open(textHref);
    void logText();
  };

  const mobileQuickActions = [
    ...(showConvertButton ? [
      {
        icon: <FileTextIcon className="h-5 w-5" />,
        label: "Schedule Job",
        onClick: () => setCreateEstimateDialogOpen(true),
        disabled: Boolean(scheduleVisitDisabledReason),
        group: "navigation",
      },
    ] : []),
    ...(showBuildEstimateAction ? [
      {
        icon: <DollarSign className="h-5 w-5" />,
        label: "Build Estimate",
        onClick: () => setLineItemsDialogOpen(true),
        group: "navigation",
      },
    ] : []),
    ...(hasEstimate && estimate?.id ? [
      {
        icon: <FileText className="h-5 w-5" />,
        label: "View Estimate",
        onClick: () => navigate(`/payments/estimates/${estimate.id}`),
        group: "navigation",
      },
    ] : []),
    {
      icon: <Navigation className="h-5 w-5" />,
      label: "Navigate",
      onClick: handleNavigate,
      disabled: !clientAddress,
      group: "navigation",
    },
    {
      icon: <Phone className="h-5 w-5" />,
      label: "Call",
      onClick: handleCall,
      disabled: !callHref,
      group: "communication",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Text",
      onClick: handleText,
      disabled: !textHref,
      group: "communication",
    },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/leads" />

      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 md:pt-8 pb-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Lead Profile</p>
            <div className="flex items-center gap-2">
              {customer?.id ? (
                <button
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="text-1 text-2xl md:text-1 text-left break-words hover:text-primary hover:underline transition-colors"
                >
                  {lead.name}
                </button>
              ) : (
                <p className="text-1 text-2xl md:text-1 break-words">{lead.name}</p>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Open lead actions menu"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Lead
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusGuidanceOpen(true)}>
                    <Info className="h-4 w-4 mr-2" />
                    Status Guide
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMarkLostDialogOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Mark as Lost
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteLeadConfig.menuLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-5">{lead.service_type || "No service type"}</p>
          </div>

          <div className="hidden w-full items-center justify-start gap-2 md:flex md:w-auto md:flex-nowrap md:justify-end">
            {callHref ? (
              <Button variant="secondary" size="icon" asChild>
                <a href={callHref} aria-label="Call lead" onClick={() => void logCall("outbound")}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="icon"
                disabled
                aria-label="Call lead unavailable: no phone number"
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {textHref ? (
              <Button variant="secondary" size="icon" asChild>
                <a href={textHref} aria-label="Text lead" onClick={() => void logText()}>
                  <MessageSquare className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="icon"
                disabled
                aria-label="Text lead unavailable: no phone number"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={handleNavigate}
              disabled={!clientAddress}
              aria-label="Navigate to lead address"
            >
              <Navigation className="h-4 w-4" />
            </Button>
            {showConvertButton && (
              scheduleVisitDisabledReason ? (
                <Tooltip>
                  <Popover>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <span tabIndex={0} aria-label={`Schedule visit unavailable: ${scheduleVisitDisabledReason}`} className="inline-flex">
                          <Button disabled size="lg" className="pointer-events-none">
                            <FileTextIcon className="h-4 w-4 shrink-0" />
                            Schedule Job
                          </Button>
                        </span>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      {scheduleVisitDisabledReason}
                    </TooltipContent>
                    <PopoverContent className="w-64 p-3 text-sm">
                      {scheduleVisitDisabledReason}
                    </PopoverContent>
                  </Popover>
                </Tooltip>
              ) : (
                <Button onClick={() => setCreateEstimateDialogOpen(true)}>
                  <FileTextIcon className="h-4 w-4 shrink-0" />
                  Schedule Job
                </Button>
              )
            )}
          </div>
        </div>

        <div
          className="bg-card rounded-lg border border-border p-5 cursor-pointer hover:shadow-md transition-all"
          onClick={() => setStatusGuidanceOpen(true)}
        >
          <div className="flex items-center justify-between gap-4 mb-6">

            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Step {currentStepIndex + 1} of {statusSteps.length}
            </p>
            <button
              type="button"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => setStatusGuidanceOpen(true)}
              aria-label={`Open lead status guide for ${getLeadStatusLabel(lead.status)}`}
            >
              <StatusBadge status={getStatusBadgeStatus(lead.status)} size="lg">
                {getLeadStatusLabel(lead.status)}
              </StatusBadge>
              
            </button>
          </div>
          <div className="relative max-w-5xl mx-auto ">
            <div className="absolute left-[12.5%] right-[12.5%] top-[10px] h-px bg-border" />
            <div className="relative grid grid-cols-4 gap-2">
            {statusSteps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isComplete = index < currentStepIndex;
              const canClick = index < 3;
              return (
                <div key={step.key} className="flex flex-col items-center gap-2 ">
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (canClick) updateLeadStatus(step.key);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2",
                      canClick ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span
                      className={cn(
                        "flex justify-center items-center h-5 w-5 rounded-full border",
                        isActive ? "bg-muted border-primary ring-4 ring-[hsl(var(--primary))]" : isComplete ? "bg-primary border-primary/40" : "bg-muted border-border"
                      )}
                    > 
                    {isActive && <Check className="w-0 h-0 text-muted"></Check>}
                    
                    
                    </span>
                   

                    <span className={cn("text-[11px] uppercase tracking-[0.16em] text-muted-foreground text-center", (isActive || isComplete) ? "text-primary font-semibold": "")}>
                      {step.label}
                    </span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>




      {/* Mark as Lost Dialog */}
      <AlertDialog open={markLostDialogOpen} onOpenChange={setMarkLostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Lost</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark "{lead.name}" as lost and send it to the archive. You can restore it later from the Archive section on the Leads page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={markAsLost}>
              Mark as Lost
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteLeadConfig.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLeadConfig.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLeadMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteLead}
              disabled={deleteLeadMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLeadMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Lead Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead and client information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Lead Information</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-service">Service Type</Label>
                  <Select
                    value={editForm.service_type}
                    onValueChange={(value) => setEditForm({ ...editForm, service_type: value })}
                  >
                    <SelectTrigger id="edit-service">
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
                  <Label htmlFor="edit-value">Budget</Label>
                  <Input
                    id="edit-value"
                    type="number"
                    value={editForm.estimated_value}
                    onChange={(e) => setEditForm({ ...editForm, estimated_value: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Client Information</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveLead} disabled={saving || !editForm.name.trim()}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Estimate Dialog */}
      {lead && (
        <CreateEstimateDialog
          open={createEstimateDialogOpen}
          onOpenChange={setCreateEstimateDialogOpen}
          hasEstimate={hasEstimate}
          lead={lead}
          onSuccess={handleEstimateSuccess}
        />
      )}

      {/* Line Items Estimate Dialog */}
      {lead && (
        <LineItemsEstimateDialog
          open={lineItemsDialogOpen}
          onOpenChange={setLineItemsDialogOpen}
          lead={lead}
          onSuccess={handleEstimateSuccess}
        />
      )}

      {/* Convert to Job Dialog */}
      <Dialog open={convertJobDialogOpen} onOpenChange={setConvertJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Job</DialogTitle>
            <DialogDescription>
              The estimate is ready. You can optionally add a schedule or convert immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="convert-scheduled-date">Scheduled Date (Optional)</Label>
              <Input
                id="convert-scheduled-date"
                type="date"
                value={jobSchedule.scheduled_date}
                onChange={(e) => setJobSchedule({ ...jobSchedule, scheduled_date: e.target.value })}
              />
            </div>

            {jobSchedule.scheduled_date && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="convert-start-time">Start Time</Label>
                  <Input
                    id="convert-start-time"
                    type="time"
                    value={jobSchedule.scheduled_time_start}
                    onChange={(e) => setJobSchedule({ ...jobSchedule, scheduled_time_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="convert-end-time">End Time</Label>
                  <Input
                    id="convert-end-time"
                    type="time"
                    value={jobSchedule.scheduled_time_end}
                    onChange={(e) => setJobSchedule({ ...jobSchedule, scheduled_time_end: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">
              {!jobSchedule.scheduled_date && "Status will be set to: Won"}
              {jobSchedule.scheduled_date && new Date(jobSchedule.scheduled_date) > new Date() && "Status will be set to: Scheduled"}
              {jobSchedule.scheduled_date && new Date(jobSchedule.scheduled_date) <= new Date() && "Status will be set to: In Progress"}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertJobDialogOpen(false)} disabled={convertingJob}>
              Cancel
            </Button>
            <Button
              onClick={convertToJob}
              disabled={convertingJob || isScheduling}
            >
              {convertingJob || isScheduling ? "Converting..." : "Convert to Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusGuidanceOpen} onOpenChange={setStatusGuidanceOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Status Stages</DialogTitle>
            <DialogDescription>
              Use this guide to understand what each lead status means and what needs to happen before moving a lead into that stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {LEAD_STATUS_GUIDANCE.map((stage) => (
              <div key={stage.value} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                  <StatusBadge status={getStatusBadgeStatus(stage.value as LeadStatus)} size="sm">
                    {stage.label}
                  </StatusBadge>
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

      

      <div className="p-4 max-w-[var(--content-max-width)] m-auto">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div className="bg-card -mx-4 md:mx-0 rounded-none md:rounded-lg md:border md:border-border overflow-hidden">
            <div className="grid grid-cols-2 px-2 md:border-b md:border-border">
              {contentTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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

            {activeTab === "details" && (
              <div className="p-5 md:p-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-8">
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-all text-base md:text-sm leading-5 text-foreground">{lead.email || "No email"}</p>
                    </div>
                  </div>
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-words text-base md:text-sm leading-5 text-foreground">{formatPhone(lead.phone)}</p>
                    </div>
                  </div>
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead Source</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-words text-base md:text-sm leading-5 text-foreground">{lead.source || "Unknown"}</p>
                    </div>
                  </div>
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-words text-base md:text-sm leading-5 text-foreground">
                        {[lead.address, lead.city].filter(Boolean).join(", ") || "No address"}
                      </p>
                    </div>
                  </div>
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-words text-base md:text-sm leading-5 text-foreground">
                        {lead.estimated_value != null ? formatCurrency(lead.estimated_value) : "Not set"}
                      </p>
                    </div>
                  </div>
                  <div className="py-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Service Type</p>
                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 break-words text-base md:text-sm leading-5 text-foreground">{lead.service_type || "Not set"}</p>
                    </div>
                  </div>
                </div>

                {!["job", "paid", "completed"].includes(lead.status) && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Qualification Checklist</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="budget-confirmed" className="cursor-pointer text-base md:text-sm text-foreground">Budget Confirmed</Label>
                          <Switch
                            id="budget-confirmed"
                            checked={qualification?.budget_confirmed ?? false}
                            onCheckedChange={(checked) => updateQualification({ budget_confirmed: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="service-area" className="cursor-pointer text-base md:text-sm text-foreground">In Service Area</Label>
                          <Switch
                            id="service-area"
                            checked={qualification?.service_area_fit ?? false}
                            onCheckedChange={(checked) => updateQualification({ service_area_fit: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="decision-maker" className="cursor-pointer text-base md:text-sm text-foreground">Decision Maker</Label>
                          <Switch
                            id="decision-maker"
                            checked={qualification?.decision_maker_confirmed ?? false}
                            onCheckedChange={(checked) => updateQualification({ decision_maker_confirmed: checked })}
                          />
                        </div>

                        <Select
                          value={qualification?.timeline || "none"}
                          onValueChange={(value) => updateQualification({ timeline: value === "none" ? null : value as TimelinePeriod })}
                        >
                          <SelectTrigger>
                            <div className="flex items-center gap-4 text-base md:text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <SelectValue placeholder="Unsure of timeline" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Timeline not confirmed</SelectItem>
                            {TIMELINE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div>
                          <Label className="text-base md:text-sm text-foreground">Qualification Notes</Label>
                          <SpeechToTextTextarea
                            value={qualNotes}
                            onValueChange={setQualNotes}
                            onBlur={() => updateQualification({ notes: qualNotes })}
                            placeholder="Add qualification notes..."
                            className="mt-1.5 text-base md:text-sm"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => setDisqualifyOpen(true)}
                        >
                          <X className="h-4 w-4 mr-1" /> Disqualify
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={markQualified}
                          disabled={lead.status === "qualified"}
                        >
                          <Check className="h-4 w-4 mr-1" /> Mark Qualified
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="p-6 space-y-4">

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


                {interactions.filter((i) => i.type === "note").map((interaction) => (
                  <div key={interaction.id} className="rounded-lg border border-border p-4">
                    <p className="text-3">
                      {parseMentionsForDisplay(getInteractionDisplayBody(interaction)).map((part, idx) =>
                        part.type === "mention" ? (
                          <span key={idx} className="font-bold text-primary">@{part.content}</span>
                        ) : (
                          <span key={idx}>{part.content}</span>
                        )
                      )}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {format(new Date(interaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-4">
              {showBuildEstimateAction && (
                <div className="hidden rounded-lg border border-dashed border-border bg-card p-4 space-y-3 md:block">
                  <p className="text-sm text-muted-foreground">No estimate available</p>
                  <Button size="lg" variant="outline" className="w-full" onClick={() => setLineItemsDialogOpen(true)}>
                    <DollarSign className="h-4 w-4" />
                    Build Estimate
                  </Button>
                </div>
              )}

              {hasEstimate && estimate && (
                <DetailEstimateCard
                  label="Estimate"
                  status={String(estimate.status || "draft")}
                  total={estimateCardTotal}
                  lineItemCount={estimate.line_items?.length || 0}
                  showStartingAt={hasMultipleEstimateVersions && !isAcceptedEstimate}
                  onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                />
              )}

          
            </div>

        

            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">Recent Activity</p>
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-5">No activity yet.</p>
                ) : (
                  recentActivity.map((interaction) => (
                    <div key={interaction.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        {getInteractionIcon(interaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {interaction.summary || interaction.type.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(interaction.created_at)}</p>
                      </div>
                      {(() => {
                        const postUrl = getInteractionPostUrl(
                          interaction.metadata,
                          interaction.body,
                          interaction.summary,
                        );

                        if (!postUrl) return null;

                        const postLabel = getInteractionPostLabel(interaction.metadata, postUrl);

                        return (
                          <Button asChild size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs">
                            <a href={postUrl} target="_blank" rel="noopener noreferrer">
                              {postLabel}
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disqualify Dialog */}
      <Dialog open={disqualifyOpen} onOpenChange={setDisqualifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disqualify Lead</DialogTitle>
            <DialogDescription>
              Select a reason for disqualifying this lead.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={disqualifyReason || ""}
            onValueChange={(value) => setDisqualifyReason(value as DisqualifyReason)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {DISQUALIFY_REASONS.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisqualifyOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisqualify}>
              Disqualify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloatingActionButton actions={mobileQuickActions} className="md:hidden" triggerIcon="wrench" />

      <MobileNav />
    </div>
  );
}
