import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Phone, MessageSquare, Calendar, Plus, Briefcase, AlertTriangle, Check, X, Clock, FileText, PhoneCall, MessageCircle, User, Trash2, MoreVertical, Edit, DollarSign, ChevronRight, Info, MapPin, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QuickEstimatePanel, QuickEstimateBreakdown } from "@/components/leads/QuickEstimatePanel";
import { CreateEstimateDialog } from "@/components/leads/CreateEstimateDialog";
import { LineItemsEstimateDialog, EstimateLineItemInit } from "@/components/leads/LineItemsEstimateDialog";
import { SERVICE_LABELS } from "@/hooks/useQuickEstimate";
import { supabase } from "@/integrations/supabase/client";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCreateJob } from "@/hooks/useJobs";
import { useDeleteLead } from "@/hooks/useLeads";
import { useQueryClient } from "@tanstack/react-query";
import { Database } from "@/integrations/supabase/types";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { PhotoSection } from "@/components/photos/PhotoSection";
import { hasPlanAccess } from "@/lib/planGating";
import { SERVICE_TYPES } from "@/constants/serviceTypes";

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

const PIPELINE_STAGES: { value: string; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "qualified", label: "Qualified", color: "bg-primary" },
];

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
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);

  // New note state
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Qualification state
  const [qualNotes, setQualNotes] = useState("");
  const [savingQual, setSavingQual] = useState(false);

  // Disqualify dialog
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState<DisqualifyReason | null>(null);

  // Delete dialog
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

  const [activeTab, setActiveTab] = useState<"details" | "photos" | "notes">("details");
  const [beforePhotoCount, setBeforePhotoCount] = useState(0);

  // Create estimate dialog
  const [createEstimateDialogOpen, setCreateEstimateDialogOpen] = useState(false);

  // Quick estimate draft dialog
  const [draftEstimateDialogOpen, setDraftEstimateDialogOpen] = useState(false);
  const [draftLineItems, setDraftLineItems] = useState<EstimateLineItemInit[]>([]);

  // Convert to job dialog with optional scheduling
  const [convertJobDialogOpen, setConvertJobDialogOpen] = useState(false);
  const [convertingJob, setConvertingJob] = useState(false);
  const [jobSchedule, setJobSchedule] = useState({
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: ""
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
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      setLead(data);
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
    const { data } = await supabase
      .from("estimates")
      .select("id, total, status, line_items:estimate_line_items(id)")
      .eq("job_id", id)
      .maybeSingle();

    setHasEstimate(!!data);
    setEstimate(data);
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
      const requiresPhotos = hasPlanAccess(currentAccount?.pricing_plan ?? "free", "basic");
      if (requiresPhotos && beforePhotoCount === 0) {
        toast.error("Please add at least one before photo to convert this lead to a job");
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
    
    if (direction === "outbound" && lead.phone) {
      window.open(`tel:${lead.phone}`);
    }
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
    
    if (lead.phone) {
      window.open(`sms:${lead.phone}`);
    }
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
    if (!disqualifyReason) {
      toast.error("Please select a reason");
      return;
    }

    await updateQualification({ disqualify_reason: disqualifyReason });
    setDisqualifyOpen(false);
    toast.success("Lead disqualified");
  };

  const handleEstimateSuccess = () => {
    fetchLead();
    checkEstimate();
  };

  const requiresPhotos = hasPlanAccess(currentAccount?.pricing_plan ?? "free", "basic");
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
    if (requiresPhotos && beforePhotoCount === 0) {
      toast.error("Please add at least one before photo to convert this lead to a job");
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

  const deleteLead = async () => {
    if (!lead?.id) return;

    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      toast.success("Lead deleted successfully");
      navigate("/leads");
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
  const isEstimateApproved = estimate?.status === "accepted";

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Lead Details" showBack backTo="/leads" />

      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {lead.status === "qualified" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  qualified
                </span>
              ) : (
                <StatusBadge status={getStatusBadgeStatus(lead.status)} size="lg">
                  {lead.status.replace("_", " ")}
                </StatusBadge>
              )}
              {lead.source && (
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  via {lead.source}
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Lead
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Lead
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lead.service_type || "No service type"}
            </p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{lead.phone || "No phone number"}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{lead.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{[lead.address, lead.city].filter(Boolean).join(", ") || "No address"}</span>
            </div>
          </div>
          {lead.estimated_value && (
            <div className="text-right ml-4">
              <p className="text-2xl font-bold text-foreground">
                ${lead.estimated_value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Estimated Value</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => logCall("outbound")}
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={logText}
          >
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          {showConvertButton && !hasEstimate && (
            <Button
              size="sm"
              className="flex-1 gap-2"
              disabled={!hasAddress}
              onClick={() => setCreateEstimateDialogOpen(true)}
            >
              <FileText className="h-4 w-4" />
              Schedule Estimate
            </Button>
          )}
          {showConvertButton && hasEstimate && isEstimateApproved && (!requiresPhotos || beforePhotoCount > 0) && (
            <Button
              size="sm"
              className="flex-1 gap-2"
              disabled={!hasAddress}
              onClick={() => setConvertJobDialogOpen(true)}
            >
              <Briefcase className="h-4 w-4" />
              Convert to Job
            </Button>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{lead.name}"? This action cannot be undone and will remove all associated data including interactions and quick estimates.
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
              Update the lead information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          lead={lead}
          onSuccess={handleEstimateSuccess}
        />
      )}

      {/* Quick Estimate Draft Dialog */}
      {lead && (
        <LineItemsEstimateDialog
          open={draftEstimateDialogOpen}
          onOpenChange={setDraftEstimateDialogOpen}
          lead={lead}
          onSuccess={handleEstimateSuccess}
          initialLineItems={draftLineItems}
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

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {[
            { id: "details", label: "Details" },
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

      {activeTab === "details" && (
        <>
          {/* Next Step Guidance */}
          {!["job", "paid", "completed"].includes(lead.status) && (
            <div className="px-4 pt-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  {lead.status === "new" && "Contact this lead to move them to the next stage."}
                  {lead.status === "contacted" && "Qualify this lead by confirming their budget, service area, and timeline below."}
                  {lead.status === "qualified" && !hasEstimate && (requiresPhotos
                    ? "Create an estimate and upload before photos to move forward."
                    : "Create an estimate to send to the customer for approval.")}
                  {lead.status === "qualified" && hasEstimate && !isEstimateApproved && (requiresPhotos && beforePhotoCount === 0
                    ? "The estimate needs to be approved and before photos added to convert this lead to a job."
                    : "The estimate needs to be approved before this lead can become a job.")}
                  {lead.status === "qualified" && hasEstimate && isEstimateApproved && requiresPhotos && beforePhotoCount === 0 && "The estimate is approved. Add at least one before photo to convert this lead to a job."}
                  {lead.status === "qualified" && hasEstimate && isEstimateApproved && (!requiresPhotos || beforePhotoCount > 0) && "The estimate is approved. Convert this lead to a job to get started."}
                </p>
              </div>
            </div>
          )}

          {/* Pipeline Stage Selector */}
          {!["job", "paid", "completed"].includes(lead.status) && (
            <div className="px-4 pt-4 pb-4">
              <h3 className="text-sm font-medium mb-2">Pipeline Stage</h3>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <button
                    key={stage.value}
                    onClick={() => updateLeadStatus(stage.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      lead.status === stage.value
                        ? `${stage.color} text-white`
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Estimate */}
          {hasEstimate && estimate && (
            <div className="px-4 pb-4">
              <button
                onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", estimate.status === "accepted" ? "bg-emerald-100" : "bg-secondary")}>
                    <DollarSign className={cn("h-5 w-5", estimate.status === "accepted" ? "text-emerald-700" : "text-secondary-foreground")} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">Estimate</p>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        estimate.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {estimate.status === "accepted" ? "Approved" : "Not Approved"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      ${Number(estimate.total).toLocaleString()} · {estimate.line_items?.length || 0} line items
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            </div>
          )}

          {/* Quick Estimate Panel */}
          {!["job", "paid", "completed"].includes(lead.status) && !hasEstimate && (
            <div className="px-4 pb-4">
              <QuickEstimatePanel
                leadId={id!}
                hasAddress={hasAddress}
                onEstimateSaved={fetchInteractions}
                onCreateDraft={(breakdown: QuickEstimateBreakdown) => {
                  const { serviceType, measurements, result } = breakdown;
                  const label = SERVICE_LABELS[serviceType];
                  const qty = serviceType === "fencing"
                    ? (measurements.linearFeet || 0)
                    : (measurements.sqft || 0);
                  const unit = serviceType === "fencing" ? "linear ft" : "sq ft";
                  const overheadAmount = result.totalMid - result.laborTotal - result.materialTotal;

                  const items: EstimateLineItemInit[] = [
                    {
                      name: `${label} - Labor`,
                      description: "",
                      quantity: qty.toString(),
                      unit,
                      unit_price: qty > 0 ? (result.laborTotal / qty).toFixed(2) : "0",
                    },
                    {
                      name: `${label} - Materials`,
                      description: "Includes waste factor",
                      quantity: qty.toString(),
                      unit,
                      unit_price: qty > 0 ? (result.materialTotal / qty).toFixed(2) : "0",
                    },
                    {
                      name: "Overhead & Profit",
                      description: "",
                      quantity: "1",
                      unit: "item",
                      unit_price: overheadAmount.toFixed(2),
                    },
                  ];

                  setDraftLineItems(items);
                  setDraftEstimateDialogOpen(true);
                }}
              />
            </div>
          )}

          {/* Qualification Panel */}
          {!["job", "paid", "completed"].includes(lead.status) && (
            <div className="px-4 pb-4">
              <div className="card-elevated rounded-lg p-4">
                <h3 className="font-medium mb-3">Qualification</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="budget-confirmed" className="cursor-pointer">Budget Confirmed</Label>
                    <Switch
                      id="budget-confirmed"
                      checked={qualification?.budget_confirmed ?? false}
                      onCheckedChange={(checked) => updateQualification({ budget_confirmed: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="service-area" className="cursor-pointer">In Service Area</Label>
                    <Switch
                      id="service-area"
                      checked={qualification?.service_area_fit ?? false}
                      onCheckedChange={(checked) => updateQualification({ service_area_fit: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="decision-maker" className="cursor-pointer">Decision Maker</Label>
                    <Switch
                      id="decision-maker"
                      checked={qualification?.decision_maker_confirmed ?? false}
                      onCheckedChange={(checked) => updateQualification({ decision_maker_confirmed: checked })}
                    />
                  </div>

                  <div>
                    <Label>Timeline</Label>
                    <Select
                      value={qualification?.timeline || "none"}
                      onValueChange={(value) => updateQualification({ timeline: value === "none" ? null : value as TimelinePeriod })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {TIMELINE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={qualNotes}
                      onChange={(e) => setQualNotes(e.target.value)}
                      onBlur={() => updateQualification({ notes: qualNotes })}
                      placeholder="Add qualification notes..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  {qualification && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Fit Score:</span>
                      <span className={cn(
                        "font-semibold",
                        calculateFitScore(qualification) >= 70 ? "text-status-confirmed" :
                        calculateFitScore(qualification) >= 40 ? "text-status-pending" : "text-status-attention"
                      )}>
                        {calculateFitScore(qualification)}/100
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={markQualified}
                      disabled={lead.status === "qualified"}
                    >
                      <Check className="h-4 w-4 mr-1" /> Mark Qualified
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDisqualifyOpen(true)}
                    >
                      <X className="h-4 w-4 mr-1" /> Disqualify
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interaction Timeline */}
          <div className="px-4 pb-4">
            <div className="card-elevated rounded-lg p-4">
              <h3 className="font-medium mb-3">Activity Timeline</h3>

              <div className="space-y-3">
                {interactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No activity yet
                  </p>
                ) : (
                  interactions.map((interaction) => (
                    <div key={interaction.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        {getInteractionIcon(interaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium capitalize">
                            {interaction.type.replace("_", " ")}
                          </span>
                          {interaction.direction !== "na" && (
                            <span className="text-xs text-muted-foreground capitalize">
                              ({interaction.direction})
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDate(interaction.created_at)}
                          </span>
                        </div>
                        {interaction.summary && (
                          <p className="text-sm text-muted-foreground">{interaction.summary}</p>
                        )}
                        {interaction.body && interaction.body !== interaction.summary && (
                          <p className="text-sm mt-1">{interaction.body}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "photos" && (
        <div className="px-4 py-4">
          <PhotoSection
            leadId={id!}
            photoType="before"
            title="Before Photos"
            onPhotosChange={setBeforePhotoCount}
          />
        </div>
      )}

      {activeTab === "notes" && (
        <div className="px-4 py-4">
          <div className="card-elevated rounded-lg p-4">
            <div className="mb-4">
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

            <div className="space-y-3">
              {interactions.filter((i) => i.type === "note").length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No notes yet</p>
                </div>
              ) : (
                interactions
                  .filter((i) => i.type === "note")
                  .map((interaction) => (
                    <div key={interaction.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">Note</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDate(interaction.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {interaction.body || interaction.summary}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

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

      <MobileNav />
    </div>
  );
}
