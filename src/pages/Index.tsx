import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardStatCards } from "@/components/dashboard/DashboardStatCards";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { JobCard } from "@/components/jobs/JobCard";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { useAuth } from "@/hooks/useAuth";
import { useQualifiedLeads, usePendingApprovalEstimates, useActiveJobs } from "@/hooks/useDashboardLeads";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { Loader as Loader2, ChevronRight } from "lucide-react";
import { DashboardVisuals } from "@/components/dashboard/DashboardVisuals";
import CrewDashboard from "./CrewDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomersNeedingAttention } from "@/hooks/useCustomersNeedingAttention";
import { CustomerCard } from "@/components/customers/CustomerCard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Index() {
  const navigate = useNavigate();
  const { user, isCrewMember, profile } = useAuth();
  const { toast } = useToast();
  const { sections } = useDashboardPreferences();
  const { data: qualifiedLeadsData = [], isLoading: leadsLoading, refetch: refetchLeads } = useQualifiedLeads();
  const { data: pendingApprovalsData = [], isLoading: approvalsLoading } = usePendingApprovalEstimates();
  const { data: activeJobsData = [], isLoading: activeJobsLoading } = useActiveJobs();
  const { data: customersData = [], isLoading: customersLoading } = useCustomersNeedingAttention();

  const SECTION_LIMIT = 3;

  const isEmailConfirmed = !!user?.email_confirmed_at;
  const firstName = profile?.full_name?.split(" ")[0] || "";

  const handleLeadClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

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
    refetchLeads();
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

  const formatLeadForCard = (lead: any): Lead => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone || "",
    serviceType: lead.service_type || "Unknown",
    estimatedBudget: Number(lead.estimated_value) || 0,
    location: [lead.address, lead.city].filter(Boolean).join(", ") || "Unknown",
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
    <AppLayout>
      <PageHeader
        title={`${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />

      <main className="px-4 py-4 space-y-6 max-w-[var(--content-max-width)] m-auto">
        {/* Email Verification Banner */}
        {user?.email && <EmailVerificationBanner email={user.email} isEmailConfirmed={isEmailConfirmed} />}

        {/* Quick Stats */}
        <DashboardStatCards />


        <div className="flex flex-col gap-8">
        {sections.includes("awaiting_approval") && !approvalsLoading && pendingApprovals.length > 0 && (
          <section>
            <SectionHeader
              title="Awaiting Approval"
              count={pendingApprovals.length}
              action={{ label: "View all", onClick: () => navigate("/payments") }}
              className="mb-3"
            />
            <div className="space-y-2">
              {pendingApprovals.slice(0, SECTION_LIMIT).map((estimate) => (
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
            {pendingApprovals.length > SECTION_LIMIT && (
              <button
                onClick={() => navigate("/payments")}
                className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View {pendingApprovals.length - SECTION_LIMIT} more
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </section>
        )}


        {sections.includes("todays_jobs") && (
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
                <p className="text-4">No jobs today</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {activeJobsData.slice(0, SECTION_LIMIT).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    />
                  ))}
                </div>
                {activeJobsData.length > SECTION_LIMIT && (
                  <button
                    onClick={() => navigate("/jobs")}
                    className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View {activeJobsData.length - SECTION_LIMIT} more
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {sections.includes("qualified_leads") && (
          <section >
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
              <>
                <div className="space-y-3">
                  {qualifiedLeads.slice(0, SECTION_LIMIT).map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => handleLeadClick(lead.id)}
                      onCall={() => window.open(`tel:${lead.phone}`)}
                      onMessage={() => window.open(`sms:${lead.phone}`)}
                      onQualify={() => handleQualify(lead.id)}
                      onViewEstimate={() => handleViewEstimate(lead.id)}
                    />
                  ))}
                </div>
                {qualifiedLeads.length > SECTION_LIMIT && (
                  <button
                    onClick={() => navigate("/leads")}
                    className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View {qualifiedLeads.length - SECTION_LIMIT} more
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {sections.includes("customers") && (
          <section>
            <SectionHeader
              title="Customers"
              count={customersData.length}
              action={{ label: "View all", onClick: () => navigate("/customers") }}
              className="mb-3"
            />
            {customersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : customersData.length === 0 ? (
              <div className="card-elevated rounded-lg p-6 text-center">
                <p className="text-muted-foreground">No customers need attention</p>
              </div>
            ) : (
              <div className="space-y-1">
                <CustomerCard
                  customer={customersData[0]}
                  onClick={() => navigate(`/customers/${customersData[0].id}`)}
                />
                <p className="text-xs text-muted-foreground text-center pt-1">
                  {customersData[0].reason}
                </p>
              </div>
            )}
          </section>
        )}
        </div>

        {/* Analytics Visuals */}
        <DashboardVisuals />
      </main>
    </AppLayout>
  );
}
