import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Clock, Circle as XCircle, Magnet, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { LeadCard, Lead, LeadStatus } from "@/components/leads/LeadCard";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useLeads, useLeadCounts, useArchivedLeads, useDeleteLead } from "@/hooks/useLeads";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { useRejectedLeads } from "@/hooks/useRejectedLeads";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sortLeadItems, type LeadSortOption } from "@/lib/pageSorting";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "archive" | LeadStatus;
type LeadListItem = Lead & { createdAtRaw: string };

export default function Leads() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<LeadSortOption>("newest");

  const { toast } = useToast();
  const { data: leadsData, isLoading, refetch } = useLeads();
  const { data: counts, refetch: refetchCounts } = useLeadCounts();
  const { data: pendingCount = 0 } = usePendingLeadsCount();
  const { data: rejectedLeads } = useRejectedLeads();
  const rejectedCount = rejectedLeads?.length || 0;
  const { data: archivedLeadsData, isLoading: archiveLoading, refetch: refetchArchived } = useArchivedLeads();
  const deleteLeadMutation = useDeleteLead();
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const handleQualify = async (leadId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ status: "qualified" })
      .eq("id", leadId);
    if (error) {
      toast({ title: "Error", description: "Failed to qualify lead", variant: "destructive" });
      return;
    }
    toast({ title: "Lead qualified" });
    refetch();
    refetchCounts();
  };

  const handleViewEstimate = async (leadId: string) => {
    const { data } = await supabase
      .from("estimates")
      .select("id")
      .eq("job_id", leadId)
      .maybeSingle();
    if (data) {
      navigate(`/payments/estimates/${data.id}`);
    } else {
      navigate(`/leads/${leadId}`);
    }
  };

  const mapLead = (lead: any): LeadListItem => {
    // Archived rows can include both legacy leads and jobs from the unified table.
    // Treat cancelled/archived (and estimate-linked rows) as job records for routing and labels.
    const hasJobSignals =
      !!lead.scheduled_date ||
      !!lead.scheduled_time_start ||
      !!lead.scheduled_time_end ||
      !!lead.crew_lead_id ||
      !!lead.recurring_job_id ||
      !!lead.estimate_job_id ||
      lead.is_estimate_visit === true ||
      lead.actual_value !== null;

    const isJobRecord =
      lead.status === "cancelled" ||
      lead.status === "archived" ||
      hasJobSignals;

    const status = (lead.status === "lost" && isJobRecord ? "cancelled" : lead.status) as LeadStatus;

    return {
      isJob: isJobRecord,
      id: lead.id,
      name: lead.name,
      phone: lead.phone || "",
      serviceType: lead.service_type || "Unknown",
      estimatedBudget: lead.estimated_value || 0,
      location: [lead.address, lead.city].filter(Boolean).join(", ") || "Unknown",
      source: lead.source || "Unknown",
      createdAt: formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }),
      createdAtRaw: lead.created_at,
      status,
      qualificationScore: lead.qualification_score || undefined,
      customer: lead.customer ? {
        id: lead.customer.id,
        name: lead.customer.name,
      } : null,
    };
  };

  const allLeads: LeadListItem[] = (leadsData || []).map(mapLead);
  const archivedLeads: LeadListItem[] = (archivedLeadsData || []).map(mapLead);

  const filteredLeads = useMemo(() => {
    const matchingLeads = allLeads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        activeFilter === "all" || lead.status === activeFilter;

      return matchesSearch && matchesFilter;
    });

    return sortLeadItems(matchingLeads, sortBy);
  }, [allLeads, searchQuery, activeFilter, sortBy]);

  const filteredArchivedLeads = useMemo(() => {
    const matchingArchivedLeads = archivedLeads.filter((lead) => {
      if (!searchQuery) return true;
      return (
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    return sortLeadItems(matchingArchivedLeads, sortBy);
  }, [archivedLeads, searchQuery, sortBy]);

  const handleUnarchive = async (leadId: string, currentStatus: LeadStatus) => {
    const newStatus = currentStatus === "archived" ? "completed" : "new";
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);
    if (error) {
      toast({ title: "Error", description: "Failed to unarchive", variant: "destructive" });
      return;
    }
    toast({ title: "Unarchived successfully" });
    refetchArchived();
    refetchCounts();
    refetch();
  };

  const handleDeleteArchived = async (leadId: string) => {
    try {
      await deleteLeadMutation.mutateAsync(leadId);
      toast({ title: "Deleted successfully" });
      refetchArchived();
      refetchCounts();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const ids = archivedLeads.map((l) => l.id);
      for (const id of ids) {
        await deleteLeadMutation.mutateAsync(id);
      }
      toast({ title: "All archived items deleted" });
      refetchArchived();
      refetchCounts();
    } catch {
      toast({ title: "Error", description: "Some items could not be deleted", variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setDeleteAllDialogOpen(false);
    }
  };

  const qualifiedCount = counts?.qualified || 0;
  const totalCount = counts?.all || 0;
  const isArchiveTab = activeFilter === "archive";
  const detailPathForLead = (lead: Lead) => (lead.isJob ? `/jobs/${lead.id}` : `/leads/${lead.id}`);
  const leadSortOptions: Array<{ value: LeadSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "value_desc", label: "Value high-low" },
    { value: "value_asc", label: "Value low-high" },
  ];
  const leadTabs: Array<{ value: FilterStatus; label: string; count: number; alignRight?: boolean }> = [
    { value: "all", label: "All", count: counts?.all || 0 },
    { value: "new", label: "New", count: counts?.new || 0 },
    { value: "contacted", label: "Contacted", count: counts?.contacted || 0 },
    { value: "qualified", label: "Qualified", count: counts?.qualified || 0 },
    { value: "archive", label: "Archive", count: counts?.archive || 0, alignRight: true },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Leads"
        subtitle={`${qualifiedCount} qualified, ${totalCount} total`}
        hideTitle
      />

      {/* Quick Access Buttons */}
      {(pendingCount > 0 || rejectedCount > 0) && (
        <div className="p-4 pb-0 max-w-[var(--content-max-width)] m-auto ">
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => navigate("/leads/pending-approval")}
                className="flex items-center gap-2
                 px-3 py-2 
                 rounded-lg 
                 bg-[hsl(var(--status-pending-bg))] 
                 text-[hsl(var(--status-pending))] text-sm font-medium
                 border border-[hsl(var(--status-pending))]
                transition-all
                shadow-sm hover:shadow-md hover:bg-[hsl(var(--status-pending))] hover:text-[hsl(var(--status-pending-bg))]  "
              >
                <Clock className="h-4 w-4" />
                {pendingCount} Pending Approval
              </button>
            )}
            {rejectedCount > 0 && (
              <button
                onClick={() => navigate("/leads/rejected")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))] text-sm font-medium hover:opacity-80 transition-opacity"
              >
                <XCircle className="h-4 w-4" />
                {rejectedCount} Rejected
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="-mx-4 md:mx-0">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search leads..."
                  className="h-14 rounded-full border-border bg-card px-5 pl-14 text-base text-foreground shadow-sm placeholder:text-muted-foreground"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sort leads"
                    className="h-14 w-14 shrink-0 rounded-full border-border bg-card shadow-sm hover:bg-card"
                  >
                    <ArrowUpDown className="!h-5 !w-5 !text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {leadSortOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setSortBy(option.value)}>
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                        {sortBy === option.value ? <Check className="h-4 w-4" /> : null}
                      </span>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pt-2 pb-6 overflow-x-auto scrollbar-hide md:pb-3">
            <div className="flex items-center gap-2 min-w-max">
              {leadTabs.map((tab) => {
                const isActive = activeFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveFilter(tab.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium transition-colors md:text-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      tab.alignRight && "ml-auto",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs", isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden px-4 pt-5 pb-3 md:block">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <Magnet className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Leads</p>
              </div>
              {isArchiveTab && filteredArchivedLeads.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteAllDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden md:rounded-2xl md:border md:border-border md:bg-card md:shadow-sm">
            {isArchiveTab ? (
              archiveLoading ? (
                <div className="px-4 pb-6">
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                </div>
              ) : filteredArchivedLeads.length === 0 ? (
                <div className="px-4 pb-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No archived leads or jobs.
                  </div>
                </div>
              ) : (
                <div>
                  {filteredArchivedLeads.map((lead, index) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      archiveMode
                      onClick={() => navigate(detailPathForLead(lead))}
                      onUnarchive={() => handleUnarchive(lead.id, lead.status)}
                      onDelete={() => handleDeleteArchived(lead.id)}
                      className={cn(
                        index > 0 && "md:relative md:before:absolute md:before:left-4 md:before:right-4 md:before:top-0 md:before:h-px md:before:bg-border",
                      )}
                    />
                  ))}
                </div>
              )
            ) : isLoading ? (
              <div className="px-4 pb-6">
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="px-4 pb-6">
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {allLeads.length === 0 ? "No leads yet. Leads will appear here when they come in via API or are created manually." : "No leads found."}
                </div>
              </div>
            ) : (
              <div>
                {filteredLeads.map((lead, index) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => navigate(detailPathForLead(lead))}
                    onCall={() => window.open(`tel:${lead.phone}`)}
                    onMessage={() => window.open(`sms:${lead.phone}`)}
                    onQualify={() => handleQualify(lead.id)}
                    onViewEstimate={() => handleViewEstimate(lead.id)}
                    className={cn(
                      index > 0 && "md:relative md:before:absolute md:before:left-4 md:before:right-4 md:before:top-0 md:before:h-px md:before:bg-border",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Archived</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete all {archivedLeads.length} archived items? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MainPageQuickActions
        onLeadCreated={(leadId) => {
          refetch();
          refetchCounts();
          if (leadId) {
            navigate(`/leads/${leadId}`);
          }
        }}
      />

      <MobileNav />
    </div>
  );
}
