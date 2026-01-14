import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Eye, AlertCircle, MapPin, DollarSign, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePendingLeads, useApproveLead, useRejectLead } from "@/hooks/usePendingLeads";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type RejectionReason = "low_budget" | "outside_service_area" | "not_ready" | "spam" | "duplicate" | "other";

const rejectionReasons: { value: RejectionReason; label: string }[] = [
  { value: "low_budget", label: "Low Budget" },
  { value: "outside_service_area", label: "Outside Service Area" },
  { value: "not_ready", label: "Not Ready" },
  { value: "spam", label: "Spam" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
];

export default function LeadsPendingApproval() {
  const navigate = useNavigate();
  const { data: pendingLeads, isLoading } = usePendingLeads();
  const approveMutation = useApproveLead();
  const rejectMutation = useRejectLead();
  
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [leadToReject, setLeadToReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<RejectionReason | "">("");

  const leads = pendingLeads || [];

  const handleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  const handleApprove = async (leadId: string) => {
    try {
      await approveMutation.mutateAsync(leadId);
      toast.success("Lead approved", {
        description: "The lead has been added to your pipeline.",
      });
    } catch (error) {
      toast.error("Failed to approve lead");
    }
  };

  const handleReject = async () => {
    if (!leadToReject || !rejectionReason) return;
    
    try {
      await rejectMutation.mutateAsync({ id: leadToReject, reason: rejectionReason });
      toast.success("Lead rejected", {
        description: "The lead has been removed from pending approvals.",
      });
      setRejectDialogOpen(false);
      setLeadToReject(null);
      setRejectionReason("");
    } catch (error) {
      toast.error("Failed to reject lead");
    }
  };

  const handleApproveAll = async () => {
    const leadsToApprove = selectedLeads.size > 0 
      ? Array.from(selectedLeads) 
      : leads.map((l) => l.id);
    
    try {
      await Promise.all(leadsToApprove.map((id) => approveMutation.mutateAsync(id)));
      toast.success(`${leadsToApprove.length} leads approved`, {
        description: "All selected leads have been added to your pipeline.",
      });
      setSelectedLeads(new Set());
    } catch (error) {
      toast.error("Failed to approve some leads");
    }
  };

  const handleRejectAll = async () => {
    if (!rejectionReason) return;
    
    const leadsToReject = selectedLeads.size > 0 
      ? Array.from(selectedLeads) 
      : leads.map((l) => l.id);
    
    try {
      await Promise.all(leadsToReject.map((id) => 
        rejectMutation.mutateAsync({ id, reason: rejectionReason })
      ));
      toast.success(`${leadsToReject.length} leads rejected`, {
        description: "All selected leads have been rejected.",
      });
      setBulkRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedLeads(new Set());
    } catch (error) {
      toast.error("Failed to reject some leads");
    }
  };

  const openRejectDialog = (leadId: string) => {
    setLeadToReject(leadId);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Leads Pending Approval"
        subtitle={`${leads.length} lead${leads.length !== 1 ? "s" : ""} waiting`}
        showBack
        backTo="/leads"
      />

      {/* Bulk Actions */}
      {leads.length > 0 && (
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedLeads.size === leads.length && leads.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedLeads.size > 0 
                  ? `${selectedLeads.size} selected` 
                  : "Select all"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleApproveAll}
                disabled={approveMutation.isPending}
                className="gap-1"
              >
                <Check className="h-4 w-4" />
                Approve {selectedLeads.size > 0 ? `(${selectedLeads.size})` : "All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectionReason("");
                  setBulkRejectDialogOpen(true);
                }}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Reject {selectedLeads.size > 0 ? `(${selectedLeads.size})` : "All"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leads List */}
      <main className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--status-confirmed-bg))] mb-4">
              <Check className="h-8 w-8 text-status-confirmed" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No leads waiting for approval right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="card-elevated rounded-lg overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={() => handleSelectLead(lead.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status="pending">Pending</StatusBadge>
                        {lead.source && (
                          <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                            via {lead.source}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-foreground text-lg">
                        {lead.name}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground font-medium mt-0.5">
                        {lead.service_type || "Unknown service"} 
                        {lead.city && ` • ${lead.city}`}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                        {lead.estimated_budget && lead.estimated_budget > 0 && (
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-status-confirmed" />
                            <span className="font-semibold text-foreground">
                              ${lead.estimated_budget.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {lead.city && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{lead.city}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(lead.submitted_at || lead.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-border">
                  <button
                    onClick={() => handleApprove(lead.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-status-confirmed hover:bg-[hsl(var(--status-confirmed-bg))] active:bg-[hsl(var(--status-confirmed-bg))]/80 transition-colors min-h-touch"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => openRejectDialog(lead.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-status-attention hover:bg-[hsl(var(--status-attention-bg))] active:bg-[hsl(var(--status-attention-bg))]/80 transition-colors min-h-touch"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Single Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Lead</DialogTitle>
            <DialogDescription>
              Please select a reason for rejecting this lead.
            </DialogDescription>
          </DialogHeader>
          <Select value={rejectionReason} onValueChange={(v) => setRejectionReason(v as RejectionReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {rejectionReasons.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              Reject Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedLeads.size > 0 ? selectedLeads.size : leads.length} Leads</DialogTitle>
            <DialogDescription>
              Please select a reason for rejecting these leads.
            </DialogDescription>
          </DialogHeader>
          <Select value={rejectionReason} onValueChange={(v) => setRejectionReason(v as RejectionReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {rejectionReasons.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectAll}
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              Reject All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
}
