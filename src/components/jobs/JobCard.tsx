import { Hammer, ChevronRight, MessageSquare, Navigation, Phone } from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/types/database";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";
import { useIsMobile } from "@/hooks/use-mobile";

type JobStatus = Database["public"]["Enums"]["unified_status"];
type DbJob = Database["public"]["Tables"]["leads"]["Row"];

export interface Job extends DbJob {
  customer?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  crew_lead?: {
    id: string;
    full_name?: string | null;
  } | null;
  scheduled_date?: string;
  last_scheduled_date?: string;
  display_status?: string;
  crew_count?: number;
  has_unassigned_schedule?: boolean;
  recurring_job_id?: string | null;
  recurring_instance_number?: number | null;
  has_invoice?: boolean;
  estimate_total?: number | null;
}

interface JobCardProps {
  job: Job;
  hideUnassignedStatus?: boolean;
  onClick?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  onNavigate?: () => void;
  showQuickActions?: boolean;
  mobileDashboardEmphasis?: boolean;
  mobileDashboardAction?: "start" | "navigate";
  mobileLayout?: "inbox" | "compact";
  className?: string;
}

function formatScheduledDateRange(
  firstDate: string | null | undefined,
  lastDate: string | null | undefined,
): string {
  if (!firstDate) return "Not scheduled";

  const first = format(new Date(`${firstDate}T00:00:00`), "EEE, MMM d");

  if (!lastDate || lastDate === firstDate) {
    return first;
  }

  const last = format(new Date(`${lastDate}T00:00:00`), "EEE, MMM d");
  return `${first} - ${last}`;
}

const jobStatusConfig: Record<string, { label: string; tone: ActivityTone }> = {
  new: { label: "New", tone: "neutral" },
  contacted: { label: "Contacted", tone: "pending" },
  qualified: { label: "Qualified", tone: "confirmed" },
  job: { label: "Job", tone: "confirmed" },
  unscheduled: { label: "Unscheduled", tone: "attention" },
  scheduled: { label: "Scheduled", tone: "pending" },
  in_progress: { label: "In Progress", tone: "pending" },
  completed: { label: "Completed", tone: "confirmed" },
};

export function JobCard({
  job,
  hideUnassignedStatus = false,
  onClick,
  onCall,
  onMessage,
  onNavigate,
  showQuickActions = false,
  mobileDashboardEmphasis = false,
  mobileDashboardAction = "start",
  mobileLayout = "inbox",
  className,
}: JobCardProps) {
  const isMobile = useIsMobile();
  const rawStatus = String(job.status || "");
  const isCompletedJob =
    rawStatus === "completed" || rawStatus === "paid" || rawStatus === "invoiced" || rawStatus === "won";
  const badgeStatus = (isCompletedJob ? "completed" : job.display_status || job.status) as string;
  const isUnassigned =
    !hideUnassignedStatus &&
    Boolean(job.has_unassigned_schedule) &&
    (badgeStatus === "scheduled" || badgeStatus === "in_progress");
  const needsInvoice = badgeStatus === "completed" && !job.has_invoice && !job.is_estimate_visit;

  const status: { label: string; tone: ActivityTone } = isUnassigned
    ? { label: "Unassigned", tone: "attention" }
    : needsInvoice
      ? { label: "Needs Invoice", tone: "attention" }
      : jobStatusConfig[badgeStatus] || { label: badgeStatus || "Active", tone: "neutral" };

  const subtitleText = `${formatScheduledDateRange(job.scheduled_date, job.last_scheduled_date)} | ${
    job.service_type || "No service type"
  }`;
  const quickActions = !showQuickActions
    ? []
    : isMobile
      ? mobileDashboardEmphasis
        ? [
            {
              label: mobileDashboardAction === "navigate" ? "Navigate" : "Start Job",
              icon:
                mobileDashboardAction === "navigate" ? (
                  <Navigation className="!h-4 !w-4" style={{ width: 16, height: 16 }} />
                ) : (
                  <ChevronRight className="!h-6 !w-6" style={{ width: 24, height: 24 }} />
                ),
              onClick: mobileDashboardAction === "navigate" ? onNavigate : onClick,
              disabled: mobileDashboardAction === "navigate" ? !onNavigate : !onClick,
              showLabel: true,
              variant: "secondary" as const,
              size: "xxl" as const,
            },
          ]
        : [
            {
              label: "Navigate",
              icon: <Navigation />,
              onClick: onNavigate,
              disabled: !onNavigate,
            },
          ]
      : [
          {
            label: "Call",
            icon: <Phone />,
            onClick: onCall,
            disabled: !onCall,
          },
          {
            label: "Text",
            icon: <MessageSquare />,
            onClick: onMessage,
            disabled: !onMessage,
          },
          {
            label: "Navigate",
            icon: <Navigation />,
            onClick: onNavigate,
            disabled: !onNavigate,
          },
        ];

  return (
    <UnifiedActivityCard
      icon={
        <Hammer
          className={mobileDashboardEmphasis ? "h-7 w-7 text-emerald-600 md:h-5 md:w-5" : "h-5 w-5 text-emerald-600"}
        />
      }
      title={
        mobileDashboardEmphasis ? (
          <span className="text-1 md:text-base">{job.customer?.name || job.name || "Unnamed Job"}</span>
        ) : (
          job.customer?.name || job.name || "Unnamed Job"
        )
      }
      subtitle={
        mobileDashboardEmphasis ? (
          <span className="hidden md:inline">{subtitleText}</span>
        ) : (
          subtitleText
        )
      }
      statusLabel={status.label}
      tone={status.tone}
      mobileLayout={mobileLayout}
      onClick={onClick}
      quickActions={quickActions}
      className={className}
    />
  );
}
