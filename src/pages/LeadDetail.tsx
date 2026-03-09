import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EllipsisVertical, Phone, MessageSquare, Calendar, Plus, Briefcase, TriangleAlert as AlertTriangle, Check, X, Clock, FileText, PhoneCall, MessageCircle, User, Trash2, MoveVertical as MoreVertical, CreditCard as Edit, DollarSign, ChevronRight, ChevronDown, Info, MapPin, Mail, Navigation, Archive, FileText as FileTextIcon, Trophy } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClientShareLink } from "@/components/jobs/ClientShareLink";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreateEstimateDialog } from "@/components/leads/CreateEstimateDialog";
import { LineItemsEstimateDialog, type EstimateLineItemInit } from "@/components/leads/LineItemsEstimateDialog";
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
import { openMapsWithAddress } from "@/lib/openMaps";
import { useAuth } from "@/hooks/useAuth";
import { useCreateJob } from "@/hooks/useJobs";
import { format } from "date-fns";

import { useQueryClient } from "@tanstack/react-query";
import { Database } from "@/types/database";
import { useScheduleJob } from "@/hooks/useScheduleJob";
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

const PIPELINE_STAGES: { value: string; label: string; color: string, bg_color: string}[] = [
  { value: "new", label: "New", color: "text-status-progress", bg_color: "status-progress-bg"},
  { value: "contacted", label: "Contacted", color: "text-status-progress",  bg_color: "status-progress-bg"},
  { value: "qualified", label: "Qualified", color: "text-status-progress",  bg_color: "status-progress-bg" },
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

  const { scheduleJob, isScheduling } = useScheduleJob();

  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pipelineInfo, setPipelineInfo] = useState(false);
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

  // Mark as lost dialog
  const [markLostDialogOpen, setMarkLostDialogOpen] = useState(false);

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
  const isEstimateApproved = estimate?.status === "accepted";

  return (
    <div className="min-h-screen  bg-surface-sunken pb-24 ">

        <PageHeader title="" showBack backTo="/leads" />

        {/* Main Info */}
        <div className=" max-w-[var(--content-max-width)] m-auto p-4 pb-0">
          <div className="bg-card rounded-lg border border-border">
          <div className="flex p-4 pt-8 pb-8">
              {/*Left Column*/}
              <div className="flex flex-col w-full justify-between gap-4">
                {/*Customer Info*/}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    {customer?.id ? (
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="text-1 hover:text-primary hover:underline transition-colors text-left"
                      >
                        {lead.name}
                      </button>
                    ) : (
                      <p className="text-1">{lead.name}</p>
                    )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <EllipsisVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={openEditDialog}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMarkLostDialogOpen(true)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Mark as Lost
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                  

                  <div className="text-5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatPhone(lead.phone)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{lead.email || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{[lead.address, lead.city].filter(Boolean).join(", ") || "No address"}</span>
                    </div>
                  </div>
                </div>

                {/*Contact Buttons*/}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => logCall("outbound")}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={logText}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const address = [lead.address, lead.city].filter(Boolean).join(", ");
                      if (address) openMapsWithAddress(address);
                    }}
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>
              
              </div>


              {/*Right Column*/}
              <div className="flex flex-col w-full justify-between ">
                {/*Job Info*/}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    
                  <StatusBadge status={getStatusBadgeStatus(lead.status)} size="lg">
                    {lead.status.replace("_", " ")}
                  </StatusBadge>
                  </div>

                  <div className="text-5 text-right animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-2">${lead.estimated_value}</p>
                    <p>{lead.service_type || "No service type"}</p>
                  </div>
                </div>

                {/*CTA*/}
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  {showConvertButton && (
                  <Button
                    size="lg"
                    disabled={!hasAddress}
                    onClick={() => setCreateEstimateDialogOpen(true)}
                  >
                    <FileTextIcon className="h-4 w-4 shrink-0" />
                    Schedule Visit
                  </Button>
                )}
                {showConvertButton && hasEstimate && isEstimateApproved && (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs whitespace-nowrap"
                    disabled={!hasAddress}
                    onClick={() => setConvertJobDialogOpen(true)}
                  >
                    <Briefcase className="h-4 w-4 shrink-0" />
                    Convert
                  </Button>
                )}
                </div>
              
              </div>

          
          </div>

          {/* Tabs */}
          <div className="max-w-[var(--content-max-width)] border-t ml-auto mr-auto px-4 ">
            {[
              { id: "details", label: "Details" },
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

      

      {activeTab === "details" && (
        <div className="p-4 flex flex-col justify-center max-w-[var(--content-max-width)] m-auto gap-4">
          

          {/* Estimate */}
          {hasEstimate && estimate && (
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
            
          )}

          {/* Client Share Link */}
          {hasEstimate && id && (lead as any).customer?.id && (
            <div className="px-4 pb-4">
              <ClientShareLink customerId={(lead as any).customer.id} />
            </div>
          )}

          {/* Create Estimate Card */}
          {!["job", "paid", "completed"].includes(lead.status) && !hasEstimate && (
            <button
              onClick={() => setLineItemsDialogOpen(true)}
              className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Create Estimate</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Add line items with quick pricing calculator
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          )}

          {/* Qualification Panel */}
          {!["job", "paid", "completed"].includes(lead.status) && (
            
              <div className="flex flex-col gap-4 card-elevated rounded-lg p-4">
              
              {/* Next Step Guidance */}
              <div className="flex gap-2 items-center pb-4 border-b border-border">

              {!["job", "paid", "completed"].includes(lead.status) && (

                <div className="flex gap-2 justify-center items-center ">
                  
                  {PIPELINE_STAGES.map((stage) => (
                        <div className="flex justify-center items-center">
                        <Button
                          key={stage.value}
                          variant={lead.status === stage.value ? "default" : "ghost"}
                          onClick={() => updateLeadStatus(stage.value)}
                          className="rounded-full"
                        >

                          <ChevronRight className="w-4 h-4"></ChevronRight>

                          {stage.label}
                        </Button>
                        
                        </div>
                      ))}
                  </div>
                  )}

                  <Button
                  variant = "ghost"
                  className="flex items-center justify-center gap-2 h-auto text-muted-foreground  whitespace-normal text-left"
                  onClick = {()=>{setPipelineInfo(prev => !prev)}}
                >
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  { pipelineInfo ? (
                  <p className="whitespace-normal break-words animate-in fade-in slide-in-from-left-5 duration-500">
                    {lead.status === "new" && "Contact this lead to move them to the next stage."}
                    {lead.status === "contacted" && "Qualify this lead by confirming their budget, service area, and timeline below."}
                    {lead.status === "qualified" && !hasEstimate && "Scheduling an estimate moves this lead into your active job pipeline."}
                    {lead.status === "qualified" && hasEstimate && !isEstimateApproved && "The estimate needs to be approved before this lead can become a job."}
                    {lead.status === "qualified" && hasEstimate && isEstimateApproved && "The estimate is approved. Convert this lead to a job to get started."}
                  </p>
                  ) : null}
                </Button>

            </div>


                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      id="budget-confirmed"
                      checked={qualification?.budget_confirmed ?? false}
                      onCheckedChange={(checked) => updateQualification({ budget_confirmed: checked })}
                    />
                    <Label htmlFor="budget-confirmed" className="cursor-pointer">Budget Confirmed</Label>
                    
                  </div>

                  <div className="flex items-center gap-4">
                    <Switch
                      id="service-area"
                      checked={qualification?.service_area_fit ?? false}
                      onCheckedChange={(checked) => updateQualification({ service_area_fit: checked })}
                    />
                    <Label htmlFor="service-area" className="cursor-pointer">In Service Area</Label>
                  </div>

                  <div className="flex items-center gap-4">


                    <Switch
                      id="decision-maker"
                      checked={qualification?.decision_maker_confirmed ?? false}
                      onCheckedChange={(checked) => updateQualification({ decision_maker_confirmed: checked })}
                    />
                    <Label htmlFor="decision-maker" className="cursor-pointer">Decision Maker</Label>
                  </div>




                    <Select
                      value={qualification?.timeline || "none"}
                      onValueChange={(value) => updateQualification({ timeline: value === "none" ? null : value as TimelinePeriod })}
                    >
                      <SelectTrigger>
                        <div className="flex items-center gap-4">
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
                </div>

                <div className="flex gap-2">
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

          )}

          {/* Interaction Timeline */}
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
      )}

      {activeTab === "notes" && (
        <div className="px-4 py-4 max-w-[var(--content-max-width)] m-auto flex flex-col gap-4">
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

            <div className="space-y-3 flex flex-col gap-4">
              {interactions.filter((i) => i.type === "note").length === 0 ? (
                null
              ) : (
                interactions
                  .filter((i) => i.type === "note")
                  .map((interaction) => (
                    <div key={interaction.id} className="card-elevated flex gap-4 rounded-lg p-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>

                      
                        <div className="flex-1 items-center justify-between gap-2 mb-0.5">
                          <p className="text-3">
                          {interaction.body || interaction.summary}
                          </p>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(interaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        
                    </div>
                  ))
              )}
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
