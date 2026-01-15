import { useState } from "react";
import { Search, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { LeadCard, Lead, LeadStatus } from "@/components/leads/LeadCard";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useLeads, useLeadCounts } from "@/hooks/useLeads";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { useRejectedLeads } from "@/hooks/useRejectedLeads";
import { formatDistanceToNow } from "date-fns";
import { UserPlus } from "lucide-react";

type FilterStatus = "all" | LeadStatus;

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default function Leads() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [showAddLead, setShowAddLead] = useState(false);

  const { data: leadsData, isLoading, refetch } = useLeads();
  const { data: counts, refetch: refetchCounts } = useLeadCounts();
  const { data: pendingCount = 0 } = usePendingLeadsCount();
  const { data: rejectedLeads } = useRejectedLeads();
  const rejectedCount = rejectedLeads?.length || 0;

  // Transform database leads to component format
  const allLeads: Lead[] = (leadsData || []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone || "",
    serviceType: lead.service_type || "Unknown",
    estimatedBudget: lead.estimated_value || 0,
    location: lead.city || "Unknown",
    source: lead.source || "Unknown",
    createdAt: formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }),
    status: lead.status as LeadStatus,
    qualificationScore: lead.qualification_score || undefined,
  }));

  const filteredLeads = allLeads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === "all" || lead.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  const qualifiedCount = counts?.qualified || 0;
  const totalCount = counts?.all || 0;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Leads"
        subtitle={`${qualifiedCount} qualified, ${totalCount} total`}
      />

      {/* Quick Access Buttons */}
      {(pendingCount > 0 || rejectedCount > 0) && (
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => navigate("/leads/pending-approval")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))] text-sm font-medium hover:opacity-80 transition-opacity"
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

      {/* Search */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-card border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {filterOptions.map((option) => {
            const count = option.value === "all" 
              ? (counts?.all || 0) 
              : (counts?.[option.value] || 0);

            return (
              <button
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-touch",
                  activeFilter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "text-2xs px-1.5 py-0.5 rounded-full",
                    activeFilter === option.value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads List */}
      <main className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => navigate(`/leads/${lead.id}`)}
                onCall={() => window.open(`tel:${lead.phone}`)}
                onMessage={() => window.open(`sms:${lead.phone}`)}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {allLeads.length === 0 ? "No leads yet" : "No leads found"}
            </p>
            {allLeads.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Leads will appear here when they come in via API or are created manually.
              </p>
            )}
          </div>
        )}
      </main>

      <FloatingActionButton
        actions={[
          {
            icon: <UserPlus className="h-5 w-5" />,
            label: "Add Lead",
            onClick: () => setShowAddLead(true),
            primary: true,
          },
        ]}
      />

      <AddLeadDialog
        open={showAddLead}
        onOpenChange={setShowAddLead}
        onLeadCreated={(leadId) => {
          refetch();
          refetchCounts();
          navigate(`/leads/${leadId}`);
        }}
      />

      <MobileNav />
    </div>
  );
}
