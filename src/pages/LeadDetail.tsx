import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MessageSquare, Calendar, Plus, Briefcase, AlertTriangle, Check, X, Clock, FileText, PhoneCall, MessageCircle, User, Trash2, MoreVertical, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QuickEstimatePanel } from "@/components/leads/QuickEstimatePanel";
import { supabase } from "@/integrations/supabase/client";
import { MobileNav } from "@/components/layout/MobileNav";
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
import { useQueryClient } from "@tanstack/react-query";
import { Database } from "@/integrations/supabase/types";

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
  fit_score: number;
  disqualify_reason: DisqualifyReason | null;
  notes: string | null;
}

const PIPELINE_STAGES: { value: string; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "qualified", label: "Qualified", color: "bg-primary" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createJobMutation = useCreateJob();

  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
  const [deleting, setDeleting] = useState(false);

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
    notes: ""
  });
  const [saving, setSaving] = useState(false);

  // Create job dialog
  const [createJobDialogOpen, setCreateJobDialogOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    price: "",
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: ""
  });

  // Creating job state
  const [creatingJob, setCreatingJob] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchInteractions();
      fetchQualification();
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
      .single();

    if (data) {
      setQualification(data as Qualification);
      setQualNotes(data.notes || "");
    }
  };

  const updateLeadStatus = async (newStatus: string) => {
    if (!lead) return;

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

  const updateQualification = async (updates: Partial<Qualification>) => {
    setSavingQual(true);

    // Calculate fit score based on toggles
    const budgetConfirmed = updates.budget_confirmed ?? qualification?.budget_confirmed ?? false;
    const serviceAreaFit = updates.service_area_fit ?? qualification?.service_area_fit ?? false;
    const decisionMakerConfirmed = updates.decision_maker_confirmed ?? qualification?.decision_maker_confirmed ?? false;
    const timeline = 'timeline' in updates ? updates.timeline : qualification?.timeline;

    let fitScore = 0;
    if (budgetConfirmed) fitScore += 30;
    if (serviceAreaFit) fitScore += 30;
    if (decisionMakerConfirmed) fitScore += 25;
    if (timeline && (timeline === "asap" || timeline === "1_2_weeks")) fitScore += 15;
    else if (timeline && timeline === "2_4_weeks") fitScore += 10;
    else if (timeline && timeline === "1_3_months") fitScore += 5;

    const payload = {
      ...updates,
      fit_score: fitScore,
      lead_id: id,
    };

    if (qualification) {
      await supabase
        .from("lead_qualifications")
        .update(payload)
        .eq("id", qualification.id);
    } else {
      await supabase.from("lead_qualifications").insert(payload);
    }

    fetchQualification();
    setSavingQual(false);
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
    await updateLeadStatus("lost");
    setDisqualifyOpen(false);
    toast.success("Lead disqualified");
  };

  const openCreateJobDialog = () => {
    setJobForm({
      price: lead?.estimated_value?.toString() || "",
      scheduled_date: "",
      scheduled_time_start: "",
      scheduled_time_end: ""
    });
    setCreateJobDialogOpen(true);
  };

  const createJob = async () => {
    if (!lead || creatingJob) return;

    if (!jobForm.price) {
      toast.error("Price is required");
      return;
    }

    setCreatingJob(true);
    const loadingToast = toast.loading("Creating job...");

    try {
      let customerId = null;

      if (lead.phone) {
        const { data: existingCustomer, error: lookupError } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", lead.phone)
          .maybeSingle();

        if (lookupError) {
          console.error("Error looking up customer:", lookupError);
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log("Found existing customer:", customerId);
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
            created_by: user?.id,
          })
          .select()
          .single();

        if (customerError) {
          console.error("Error creating customer:", customerError);
          throw new Error("Failed to create customer record");
        }

        customerId = newCustomer.id;
        console.log("Created new customer:", customerId);
      }

      let newStatus: LeadStatus = "won";

      if (jobForm.scheduled_date) {
        const scheduledDate = new Date(jobForm.scheduled_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        scheduledDate.setHours(0, 0, 0, 0);

        if (scheduledDate <= today) {
          newStatus = "in_progress";
        } else {
          newStatus = "scheduled";
        }
      }

      const { data: jobData, error: updateError } = await supabase
        .from("leads")
        .update({
          customer_id: customerId,
          status: newStatus,
          actual_value: parseFloat(jobForm.price),
          scheduled_date: jobForm.scheduled_date || null,
          scheduled_time_start: jobForm.scheduled_time_start || null,
          scheduled_time_end: jobForm.scheduled_time_end || null,
        })
        .eq("id", lead.id)
        .select(`
          *,
          customer:customers!leads_customer_id_fkey(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .single();

      if (updateError) {
        console.error("Error converting lead to job:", updateError);
        throw new Error("Failed to convert lead to job");
      }

      console.log("Lead converted to job successfully:", jobData.id);

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "status_change" as InteractionType,
        direction: "na" as InteractionDirection,
        summary: "Converted to job",
        created_by: user?.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Lead converted to job successfully!");

      if (jobData) {
        queryClient.setQueryData(["job", jobData.id], jobData);
      }

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });

      setCreateJobDialogOpen(false);
      navigate(`/jobs/${jobData.id}`);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to create job");
    } finally {
      setCreatingJob(false);
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
      notes: lead.notes || ""
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
          notes: editForm.notes || null,
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
    if (!lead) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead deleted successfully");
      navigate("/leads");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    } finally {
      setDeleting(false);
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
      case "scheduled":
      case "won":
        return "confirmed";
      case "new":
      case "contacted":
      case "in_progress":
        return "pending";
      case "lost":
        return "attention";
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
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </header>
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

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">{lead.service_type || "No service type"}</p>
          </div>
          {lead.status === "qualified" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              qualified
            </span>
          ) : (
            <StatusBadge status={getStatusBadgeStatus(lead.status)}>
              {lead.status.replace("_", " ")}
            </StatusBadge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
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
      </header>
      
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
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteLead}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
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
              <Input
                id="edit-service"
                value={editForm.service_type}
                onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                placeholder="e.g., Lawn Care, Tree Removal"
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
            <div className="space-y-2">
              <Label htmlFor="edit-value">Estimated Value</Label>
              <Input
                id="edit-value"
                type="number"
                value={editForm.estimated_value}
                onChange={(e) => setEditForm({ ...editForm, estimated_value: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
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

      {/* Create Job Dialog */}
      <Dialog open={createJobDialogOpen} onOpenChange={setCreateJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Job</DialogTitle>
            <DialogDescription>
              Set the price and schedule for this job. The status will be automatically set based on the schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="job-price">Price *</Label>
              <Input
                id="job-price"
                type="number"
                value={jobForm.price}
                onChange={(e) => setJobForm({ ...jobForm, price: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-date">Scheduled Date</Label>
              <Input
                id="job-date"
                type="date"
                value={jobForm.scheduled_date}
                onChange={(e) => setJobForm({ ...jobForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-start-time">Start Time</Label>
                <Input
                  id="job-start-time"
                  type="time"
                  value={jobForm.scheduled_time_start}
                  onChange={(e) => setJobForm({ ...jobForm, scheduled_time_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-end-time">End Time</Label>
                <Input
                  id="job-end-time"
                  type="time"
                  value={jobForm.scheduled_time_end}
                  onChange={(e) => setJobForm({ ...jobForm, scheduled_time_end: e.target.value })}
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">
              {!jobForm.scheduled_date && "Status will be set to: Won"}
              {jobForm.scheduled_date && new Date(jobForm.scheduled_date) > new Date() && "Status will be set to: Scheduled"}
              {jobForm.scheduled_date && new Date(jobForm.scheduled_date) <= new Date() && "Status will be set to: In Progress"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateJobDialogOpen(false)} disabled={creatingJob}>
              Cancel
            </Button>
            <Button onClick={createJob} disabled={creatingJob || !jobForm.price}>
              {creatingJob ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Info Card */}
      <div className="px-4 py-4">
        <div className="card-elevated rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.phone && (
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{lead.phone}</p>
              </div>
            )}
            {lead.email && (
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="font-medium truncate">{lead.email}</p>
              </div>
            )}
            {lead.city && (
              <div>
                <span className="text-muted-foreground">Location</span>
                <p className="font-medium">{lead.city}</p>
              </div>
            )}
            {lead.estimated_value && (
              <div>
                <span className="text-muted-foreground">Budget</span>
                <p className="font-medium text-status-confirmed">
                  ${lead.estimated_value.toLocaleString()}
                </p>
              </div>
            )}
            {lead.source && (
              <div>
                <span className="text-muted-foreground">Source</span>
                <p className="font-medium capitalize">{lead.source}</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => logCall("outbound")} disabled={creatingJob}>
              <Phone className="h-4 w-4 mr-1" /> Call
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={logText} disabled={creatingJob}>
              <MessageSquare className="h-4 w-4 mr-1" /> Text
            </Button>
            {showConvertButton && (
              <Button size="sm" className="flex-1" onClick={openCreateJobDialog} disabled={creatingJob}>
                <Briefcase className="h-4 w-4 mr-1" />
                Create Job
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Stage Selector */}
      <div className="px-4 pb-4">
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

      {/* Quick Estimate Panel */}
      <div className="px-4 pb-4">
        <QuickEstimatePanel 
          leadId={id!} 
          onEstimateSaved={fetchInteractions}
          onConvertToEstimate={(estimateId) => {
            toast.success("Draft created! Redirecting to estimates...");
            navigate("/payments");
          }}
        />
      </div>

      {/* Qualification Panel */}
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

            {qualification?.fit_score !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Fit Score:</span>
                <span className={cn(
                  "font-semibold",
                  qualification.fit_score >= 70 ? "text-status-confirmed" :
                  qualification.fit_score >= 40 ? "text-status-pending" : "text-status-attention"
                )}>
                  {qualification.fit_score}/100
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

      {/* Interaction Timeline */}
      <div className="px-4 pb-4">
        <div className="card-elevated rounded-lg p-4">
          <h3 className="font-medium mb-3">Activity Timeline</h3>

          {/* Add Note */}
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

          {/* Timeline */}
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
