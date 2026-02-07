import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { JobCard } from "@/components/jobs/JobCard";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { useAuth } from "@/hooks/useAuth";
import { useQualifiedLeads, usePendingApprovalEstimates, useActiveJobs } from "@/hooks/useDashboardLeads";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { getCardConfig } from "@/constants/dashboardCards";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import CrewDashboard from "./CrewDashboard";

export default function Index() {
  const navigate = useNavigate();
  const { user, isCrewMember } = useAuth();
  const { cards: selectedCardIds } = useDashboardPreferences();
  const { data: stats = {} } = useDashboardStats(selectedCardIds);
  const { data: qualifiedLeadsData = [], isLoading: leadsLoading } = useQualifiedLeads();
  const { data: pendingApprovalsData = [], isLoading: approvalsLoading } = usePendingApprovalEstimates();
  const { data: activeJobsData = [], isLoading: activeJobsLoading } = useActiveJobs();

  const isEmailConfirmed = !!user?.email_confirmed_at;

  const handleLeadClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const formatLeadForCard = (lead: any): Lead => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone || "",
    serviceType: lead.service_type || "Unknown",
    estimatedBudget: Number(lead.estimated_value) || 0,
    location: lead.city || "Unknown",
    source: lead.source || "Unknown",
    createdAt: formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }),
    status: lead.status,
    qualificationScore: lead.qualification_score || 0,
  });

  const qualifiedLeads = qualifiedLeadsData.map(formatLeadForCard);
  const pendingApprovals = pendingApprovalsData.map((estimate: any) => ({
    id: estimate.id,
    clientName: estimate.customer?.name || "Unknown",
    serviceType: estimate.name || "Estimate",
    estimateValue: Number(estimate.total_amount) || 0,
    sentAt: formatDistanceToNow(new Date(estimate.created_at), { addSuffix: true }),
  }));

  if (isCrewMember()) {
    return <CrewDashboard />;
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Good morning" subtitle="Monday, January 13" notificationCount={3} />

      <main className="px-4 py-4 space-y-6">
        {/* Email Verification Banner */}
        {user?.email && <EmailVerificationBanner email={user.email} isEmailConfirmed={isEmailConfirmed} />}

        {/* Quick Stats */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {selectedCardIds.map((cardId) => {
            const config = getCardConfig(cardId);
            if (!config) return null;
            const value = cardId === "revenue_this_month"
              ? `$${(stats[cardId] || 0).toLocaleString()}`
              : (stats[cardId] ?? 0);
            return (
              <StatCard
                key={cardId}
                label={config.label}
                value={value}
                icon={config.icon}
                variant={config.variant}
                onClick={() => navigate(config.navigateTo)}
              />
            );
          })}
        </div>

        {/* Pending Approvals */}
        {!approvalsLoading && pendingApprovals.length > 0 && (
          <section>
            <SectionHeader
              title="Awaiting Approval"
              count={pendingApprovals.length}
              action={{ label: "View all", onClick: () => navigate("/payments") }}
              className="mb-3"
            />
            <div className="space-y-2">
              {pendingApprovals.map((estimate) => (
                <button
                  key={estimate.id}
                  onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{estimate.clientName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {estimate.serviceType} • Sent {estimate.sentAt}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">${estimate.estimateValue.toLocaleString()}</p>
                      <span className="status-pending text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                        Pending
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Today's Jobs */}
        <section>
          <SectionHeader
            title="Today's Jobs"
            count={activeJobsData.length}
            action={{ label: "View all", onClick: () => navigate("/jobs") }}
            className="mb-3"
          />
          {activeJobsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeJobsData.length === 0 ? (
            <div className="card-elevated rounded-lg p-6 text-center">
              <p className="text-muted-foreground">No jobs today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobsData.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Qualified Leads */}
        <section>
          <SectionHeader
            title="Qualified Leads"
            count={qualifiedLeads.length}
            action={{ label: "View all", onClick: () => navigate("/leads") }}
            className="mb-3"
          />
          {leadsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : qualifiedLeads.length === 0 ? (
            <div className="card-elevated rounded-lg p-6 text-center">
              <p className="text-muted-foreground">No qualified leads at the moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {qualifiedLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => handleLeadClick(lead.id)}
                  onCall={() => {
                    if (import.meta.env.DEV) console.log("Call", lead.phone);
                  }}
                  onMessage={() => {
                    if (import.meta.env.DEV) console.log("Message", lead.phone);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
