import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
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
import { Loader as Loader2, ChevronRight, Clock3, Search } from "lucide-react";
import CrewDashboard from "./CrewDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { openMapsWithAddress } from "@/lib/openMaps";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { useIsMobile } from "@/hooks/use-mobile";
import { OPEN_GLOBAL_SEARCH_EVENT } from "@/lib/keyboardShortcuts";
import { JoinSkoolModal } from "@/components/modals/JoinSkoolModal";
import {
  clearPostOnboardingSkoolModalPending,
  getSignupSource,
  shouldShowPostOnboardingSkoolModal,
} from "@/lib/onboarding";


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatStartTime(time?: string | null): string | null {
  if (!time) return null;

  const [hours, minutes] = time.split(":").map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, "h:mm a");
}

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, isCrewMember, profile } = useAuth();
  const { toast } = useToast();
  const [showSkoolModal, setShowSkoolModal] = useState(false);
  const { sections } = useDashboardPreferences();
  const { data: qualifiedLeadsData = [], isLoading: leadsLoading, refetch: refetchLeads } = useQualifiedLeads();
  const { data: pendingApprovalsData = [], isLoading: approvalsLoading } = usePendingApprovalEstimates();
  const { data: activeJobsData = [], isLoading: activeJobsLoading } = useActiveJobs();

  const SECTION_LIMIT = 3;

  const isEmailConfirmed = !!user?.email_confirmed_at;
  const firstName = profile?.full_name?.split(" ")[0] || "";

  useEffect(() => {
    console.log("Henry is connected");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("skoolModal") !== "1") {
      return;
    }

    setShowSkoolModal(true);
    params.delete("skoolModal");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!shouldShowPostOnboardingSkoolModal()) {
      return;
    }

    clearPostOnboardingSkoolModalPending();

    if (getSignupSource() === "elo") {
      return;
    }

    setShowSkoolModal(true);
  }, []);

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

  const openPhoneCall = (phone?: string | null) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  const openTextMessage = (phone?: string | null) => {
    if (!phone) return;
    window.open(`sms:${phone}`);
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

  const joinSkoolUrl = import.meta.env.VITE_SKOOL_JOIN_URL ?? null;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <JoinSkoolModal
        open={showSkoolModal}
        onOpenChange={setShowSkoolModal}
        joinUrl={joinSkoolUrl}
      />
      <PageHeader

      />



      <main className="flex flex-col gap-8 px-4 py-4 space-y-6 max-w-[1200px] m-auto">
        {/* Email Verification Banner */}
        {user?.email && <EmailVerificationBanner email={user.email} isEmailConfirmed={isEmailConfirmed} />}

        <div className="flex flex-col gap-6 md:gap-0">
          {isMobile && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
                className="flex w-full items-center gap-3 rounded-full border border-border bg-card px-5 py-4 text-left text-muted-foreground shadow-sm"
                aria-label="Search pages"
              >
                <Search className="h-5 w-5" />
                <span className="text-base">Search pages</span>
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-start gap-3 pt-0 md:mt-0 md:pt-8">
            <div className="min-w-[16rem] flex-1 flex flex-col gap-2">
              <h1 className="text-4xl font-semibold tracking-tight">
                {isMobile ? "Today's Jobs" : `${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
              </h1>
              <p className=" text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="hidden md:block">
          <DashboardStatCards />
        </div>

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


        <div className="flex flex-wrap gap-8">
        {sections.includes("todays_jobs") && (
          <section className="-mx-4 -mt-8 flex-1 min-w-[320px] md:mx-0 md:mt-0">
            <div className={isMobile ? "" : "card-elevated overflow-hidden rounded-none md:rounded-lg"}>
              <div className="hidden border-b border-border p-4 md:block">
                <SectionHeader
                  title="Today's Jobs"
                  count={activeJobsData.length}
                  action={{ label: "View all", onClick: () => navigate("/jobs") }}
                />
              </div>
              {activeJobsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeJobsData.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-4">No jobs today</p>
                </div>
              ) : (
                <>
                  <div className={isMobile ? "space-y-10" : "divide-y divide-border"}>
                    {activeJobsData.slice(0, SECTION_LIMIT).map((job) => {
                      const startTime = formatStartTime((job as { scheduled_time_start?: string | null }).scheduled_time_start);

                      return (
                      <div key={job.id} className={isMobile ? "space-y-1.5" : ""}>
                        {startTime ? (
                          <p className="px-4 text-sm text-muted-foreground md:hidden inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4" />
                            {startTime}
                          </p>
                        ) : null}
                        <JobCard
                          job={job}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          onCall={job.phone || job.customer?.phone ? () => openPhoneCall(job.phone || job.customer?.phone) : undefined}
                          onMessage={job.phone || job.customer?.phone ? () => openTextMessage(job.phone || job.customer?.phone) : undefined}
                          onNavigate={
                            [job.address, job.city, job.state, job.customer?.address].filter(Boolean).length > 0
                              ? () =>
                                  openMapsWithAddress(
                                    [job.address, job.city, job.state, job.customer?.address]
                                      .filter(Boolean)
                                      .join(", "),
                                  )
                              : undefined
                          }
                          showQuickActions
                          mobileDashboardEmphasis
                          className={
                            isMobile
                              ? "rounded-none border-b border-border py-7"
                              : "rounded-none border-0 bg-transparent py-7 shadow-none hover:bg-accent/40 md:py-3"
                          }
                        />
                      </div>
                    )})}
                  </div>
                  {activeJobsData.length > SECTION_LIMIT && (
                    <button
                      onClick={() => navigate("/jobs")}
                      className="w-full border-t border-border flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View {activeJobsData.length - SECTION_LIMIT} more
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {sections.includes("qualified_leads") && (
          <section className="hidden md:block flex-1 min-w-[320px]">
            <div className="card-elevated rounded-lg overflow-hidden">
              <div className="border-b border-border p-4">
                <SectionHeader
                  title="Qualified Leads"
                  count={qualifiedLeads.length}
                  action={{ label: "View all", onClick: () => navigate("/leads") }}
                />
              </div>
              {leadsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : qualifiedLeads.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground">No qualified leads at the moment</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {qualifiedLeads.slice(0, SECTION_LIMIT).map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => handleLeadClick(lead.id)}
                        onCall={lead.phone ? () => openPhoneCall(lead.phone) : undefined}
                        onMessage={lead.phone ? () => openTextMessage(lead.phone) : undefined}
                        onNavigate={lead.location && lead.location !== "Unknown" ? () => openMapsWithAddress(lead.location) : undefined}
                        showQuickActions
                        onQualify={() => handleQualify(lead.id)}
                        onViewEstimate={() => handleViewEstimate(lead.id)}
                        className="rounded-none border-0 bg-transparent shadow-none hover:bg-accent/40"
                      />
                    ))}
                  </div>
                  {qualifiedLeads.length > SECTION_LIMIT && (
                    <button
                      onClick={() => navigate("/leads")}
                      className="w-full border-t border-border flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View {qualifiedLeads.length - SECTION_LIMIT} more
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        </div>

        </div>
      </main>

      <MainPageQuickActions
        onLeadCreated={(leadId) => {
          if (leadId) navigate(`/leads/${leadId}`);
        }}
      />

      <MobileNav />
    </div>
  );
}
