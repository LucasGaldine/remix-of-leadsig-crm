import { useState } from "react";
import { Clock, XCircle, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { ListPageFilters } from "@/components/layout/ListPageFilters";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { LeadCard, Lead, LeadStatus } from "@/components/leads/LeadCard";
import { useNavigate } from "react-router-dom";
import { useLeads, useLeadCounts } from "@/hooks/useLeads";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { useRejectedLeads } from "@/hooks/useRejectedLeads";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type FilterStatus = "all" | LeadStatus;

export default function Leads() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [showAddLead, setShowAddLead] = useState(false);

  const { toast } = useToast();
  const { data: leadsData, isLoading, refetch } = useLeads();
  const { data: counts, refetch: refetchCounts } = useLeadCounts();
  const { data: pendingCount = 0 } = usePendingLeadsCount();
  const { data: rejectedLeads } = useRejectedLeads();
  const rejectedCount = rejectedLeads?.length || 0;

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

      <ListPageFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search leads..."
        tabs={[
          { value: "all", label: "All", count: counts?.all || 0 },
          { value: "new", label: "New", count: counts?.new || 0 },
          { value: "contacted", label: "Contacted", count: counts?.contacted || 0 },
          { value: "qualified", label: "Qualified", count: counts?.qualified || 0 },
        ]}
        activeTab={activeFilter}
        onTabChange={(v) => setActiveFilter(v as FilterStatus)}
      />

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
                onQualify={() => handleQualify(lead.id)}
                onViewEstimate={() => handleViewEstimate(lead.id)}
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
