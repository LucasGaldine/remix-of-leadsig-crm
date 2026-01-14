import { useNavigate } from "react-router-dom";
import { Calendar, Clock, AlertCircle, UserCheck, DollarSign, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { JobCard, Job } from "@/components/jobs/JobCard";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";

// Demo data - will be replaced with real data from database
const todaysJobs: Job[] = [
  {
    id: "1",
    clientName: "Johnson Residence",
    clientAddress: "1234 Oak Street, Springfield",
    serviceType: "Patio Installation",
    scheduledTime: "8:00 AM - 12:00 PM",
    status: "in-progress",
    crewLead: "Mike Thompson",
    estimateValue: 8500,
  },
  {
    id: "2",
    clientName: "Anderson Property",
    clientAddress: "567 Maple Ave, Riverside",
    serviceType: "Retaining Wall",
    scheduledTime: "1:00 PM - 5:00 PM",
    status: "scheduled",
    crewLead: "Carlos Rodriguez",
    estimateValue: 12000,
  },
];

const qualifiedLeads: Lead[] = [
  {
    id: "1",
    name: "Sarah Mitchell",
    phone: "(555) 123-4567",
    serviceType: "Driveway Pavers",
    estimatedBudget: 15000,
    location: "Oak Park",
    source: "Google",
    createdAt: "2 hours ago",
    status: "qualified",
    qualificationScore: 92,
  },
  {
    id: "2",
    name: "Robert Chen",
    phone: "(555) 987-6543",
    serviceType: "Backyard Renovation",
    estimatedBudget: 25000,
    location: "Riverside",
    source: "Referral",
    createdAt: "4 hours ago",
    status: "qualified",
    qualificationScore: 88,
  },
];

const pendingApprovals = [
  {
    id: "1",
    clientName: "Williams Family",
    serviceType: "Pool Deck",
    estimateValue: 18500,
    sentAt: "Yesterday",
  },
  {
    id: "2",
    clientName: "Garcia Home",
    serviceType: "Fire Pit Area",
    estimateValue: 6800,
    sentAt: "2 days ago",
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: pendingLeadsCount = 0 } = usePendingLeadsCount();

  // Check if email is confirmed (Supabase stores this in email_confirmed_at)
  const isEmailConfirmed = !!user?.email_confirmed_at;

  const handleJobClick = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleLeadClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Good morning" subtitle="Monday, January 13" notificationCount={3} />

      <main className="px-4 py-4 space-y-6">
        {/* Email Verification Banner */}
        {user?.email && <EmailVerificationBanner email={user.email} isEmailConfirmed={isEmailConfirmed} />}

        {/* Quick Stats */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <StatCard
            label="Today's Jobs"
            value={todaysJobs.length}
            icon={Calendar}
            variant="success"
            onClick={() => navigate("/schedule")}
          />
          <StatCard
            label="Leads Pending"
            value={pendingLeadsCount}
            icon={CheckCircle}
            variant={pendingLeadsCount > 0 ? "warning" : "success"}
            onClick={() => navigate("/leads/pending-approval")}
          />
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals.length}
            icon={Clock}
            variant="warning"
            onClick={() => navigate("/payments")}
          />
          <StatCard
            label="Qualified Leads"
            value={qualifiedLeads.length}
            icon={UserCheck}
            variant="success"
            onClick={() => navigate("/leads")}
          />
        </div>

        {/* Today's Jobs */}
        <section>
          <SectionHeader
            title="Today's Jobs"
            count={todaysJobs.length}
            action={{ label: "View all", onClick: () => navigate("/schedule") }}
            className="mb-3"
          />
          <div className="space-y-3">
            {todaysJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => handleJobClick(job.id)} />
            ))}
          </div>
        </section>

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
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

        {/* Qualified Leads */}
        <section>
          <SectionHeader
            title="Qualified Leads"
            count={qualifiedLeads.length}
            action={{ label: "View all", onClick: () => navigate("/leads") }}
            className="mb-3"
          />
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
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
