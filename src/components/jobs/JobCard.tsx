import { Briefcase, MessageSquare, Navigation, Phone } from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/types/database";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";

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
  onClick?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  onNavigate?: () => void;
  showQuickActions?: boolean;
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
  unscheduled: { label: "Unscheduled", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "pending" },
  in_progress: { label: "In Progress", tone: "pending" },
  completed: { label: "Completed", tone: "confirmed" },
};

export function JobCard({ job, onClick, onCall, onMessage, onNavigate, showQuickActions = false, className }: JobCardProps) {
  const badgeStatus = (job.display_status || job.status) as string;
  const isUnassigned =
    Boolean(job.has_unassigned_schedule) &&
    (badgeStatus === "unscheduled" || badgeStatus === "scheduled" || badgeStatus === "in_progress");
  const needsInvoice = job.status === "completed" && !job.has_invoice && !job.is_estimate_visit;

  const status: { label: string; tone: ActivityTone } = isUnassigned
    ? { label: "Unassigned", tone: "attention" }
    : needsInvoice
      ? { label: "Needs Invoice", tone: "attention" }
      : jobStatusConfig[badgeStatus] || { label: badgeStatus || "Active", tone: "neutral" };

  const subtitle = `${formatScheduledDateRange(job.scheduled_date, job.last_scheduled_date)} | ${
    job.service_type || "No service type"
  }`;

  return (
    <UnifiedActivityCard
      icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
      title={job.customer?.name || job.name || "Unnamed Job"}
      subtitle={subtitle}
      statusLabel={status.label}
      tone={status.tone}
      onClick={onClick}
      quickActions={
        showQuickActions
          ? [
              { label: "Call", icon: <Phone className="h-4 w-4" />, onClick: onCall, disabled: !onCall },
              { label: "Text", icon: <MessageSquare className="h-4 w-4" />, onClick: onMessage, disabled: !onMessage },
              { label: "Navigate", icon: <Navigation className="h-4 w-4" />, onClick: onNavigate, disabled: !onNavigate },
            ]
          : []
      }
      className={className}
    />
  );
}
