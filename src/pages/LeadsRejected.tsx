import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Eye, Trash2, MapPin, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRejectedLeads, useRestoreLead, useDeleteRejectedLead, useDeleteAllRejectedLeads } from "@/hooks/useRejectedLeads";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const rejectionReasonLabels: Record<string, string> = {
  low_budget: "Low Budget",
  outside_service_area: "Outside Service Area",
  not_ready: "Not Ready",
  spam: "Spam",
  duplicate: "Duplicate",
  other: "Other",
};

export default function LeadsRejected() {
  const navigate = useNavigate();
  const { data: rejectedLeads, isLoading } = useRejectedLeads();
  const restoreMutation = useRestoreLead();
  const deleteMutation = useDeleteRejectedLead();
  const deleteAllMutation = useDeleteAllRejectedLeads();

  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [leadToRestore, setLeadToRestore] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const leads = rejectedLeads || [];

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

  const handleRestore = async (leadId: string) => {
    try {
      await restoreMutation.mutateAsync(leadId);
      toast.success("Lead restored", {
        description: "The lead has been moved back to pending approval.",
      });
    } catch (error) {
      toast.error("Failed to restore lead");
    }
  };

  const handleRestoreAll = async () => {
    const leadsToRestore = selectedLeads.size > 0 
      ? Array.from(selectedLeads) 
      : leads.map((l) => l.id);
    
    try {
      await Promise.all(leadsToRestore.map((id) => restoreMutation.mutateAsync(id)));
      toast.success(`${leadsToRestore.length} leads restored`, {
        description: "All selected leads have been moved back to pending approval.",
      });
      setSelectedLeads(new Set());
    } catch (error) {
      toast.error("Failed to restore some leads");
    }
  };

  const openRestoreDialog = (leadId: string) => {
    setLeadToRestore(leadId);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = async () => {
    if (leadToRestore) {
      await handleRestore(leadToRestore);
      setRestoreDialogOpen(false);
      setLeadToRestore(null);
    }
  };

  const openDeleteDialog = (leadId: string) => {
    setLeadToDelete(leadId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (leadToDelete) {
      try {
        await deleteMutation.mutateAsync(leadToDelete);
        toast.success("Lead deleted", {
          description: "The lead has been permanently deleted.",
        });
        setDeleteDialogOpen(false);
        setLeadToDelete(null);
      } catch (error) {
        toast.error("Failed to delete lead");
      }
    }
  };

  const openDeleteAllDialog = () => {
    setDeleteAllDialogOpen(true);
  };

  const confirmDeleteAll = async () => {
    const leadsToDelete = selectedLeads.size > 0
      ? Array.from(selectedLeads)
      : undefined;

    try {
      await deleteAllMutation.mutateAsync(leadsToDelete);
      const count = leadsToDelete?.length || leads.length;
      toast.success(`${count} lead${count !== 1 ? 's' : ''} deleted`, {
        description: "The leads have been permanently deleted.",
      });
      setSelectedLeads(new Set());
      setDeleteAllDialogOpen(false);
    } catch (error) {
      toast.error("Failed to delete leads");
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Rejected Leads"
        subtitle={`${leads.length} lead${leads.length !== 1 ? "s" : ""} rejected`}
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
                variant="outline"
                size="sm"
                onClick={handleRestoreAll}
                disabled={restoreMutation.isPending}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Restore {selectedLeads.size > 0 ? `(${selectedLeads.size})` : "All"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={openDeleteAllDialog}
                disabled={deleteAllMutation.isPending}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Delete {selectedLeads.size > 0 ? `(${selectedLeads.size})` : "All"}
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">No rejected leads</h3>
            <p className="text-muted-foreground">
              Leads you reject will appear here.
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
                        <StatusBadge status="attention">Rejected</StatusBadge>
                        {lead.approval_reason && (
                          <span className="text-2xs text-muted-foreground">
                            {rejectionReasonLabels[lead.approval_reason] || lead.approval_reason}
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
                        {lead.estimated_value && lead.estimated_value > 0 && (
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              ${lead.estimated_value.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {lead.source && (
                          <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                            via {lead.source}
                          </span>
                        )}
                        {lead.rejected_at && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Rejected {formatDistanceToNow(new Date(lead.rejected_at), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-border">
                  <button
                    onClick={() => openRestoreDialog(lead.id)}
                    disabled={restoreMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => openDeleteDialog(lead.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors min-h-touch"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the lead back to pending approval where you can review and approve it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeads.size > 0 ? `${selectedLeads.size} Lead${selectedLeads.size !== 1 ? 's' : ''}` : 'All Leads'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedLeads.size > 0 ? `the selected ${selectedLeads.size} lead${selectedLeads.size !== 1 ? 's' : ''}` : 'all rejected leads'} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete {selectedLeads.size > 0 ? 'Selected' : 'All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
