import { MapPin, Clock, User, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

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
}

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
}

function formatScheduledDateRange(
  firstDate: string | null | undefined,
  lastDate: string | null | undefined,
): string {
  if (!firstDate) return "Not scheduled";

  const first = format(new Date(firstDate + "T00:00:00"), "EEE, MMM d");

  if (!lastDate || lastDate === firstDate) {
    return first;
  }

  const last = format(new Date(lastDate + "T00:00:00"), "EEE, MMM d");
  return `${first} - ${last}`;
}

export function JobCard({ job, onClick, className }: JobCardProps) {
  const statusLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    paid: "Paid",
  };

  const badgeStatus = (job.display_status || job.status) as string;
  const scheduledDateTime = formatScheduledDateRange(job.scheduled_date, job.last_scheduled_date);
  const address = [job.address, job.city].filter(Boolean).join(", ") || job.customer?.address || "No address";
  const value = Number(job.actual_value) || Number(job.estimated_value);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left card-elevated rounded-lg p-4 transition-all",
        "active:scale-[0.98] hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={badgeStatus as JobStatus}>
              {statusLabels[badgeStatus] || badgeStatus}
            </StatusBadge>
          </div>

          <h3 className="font-semibold text-foreground truncate text-lg">
            {job.customer?.name || job.name}
          </h3>

          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {job.is_estimate_visit
              ? `${job.service_type || "No service type"}, Estimate`
              : job.service_type || "No service type"}
          </p>

          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{scheduledDateTime}</span>
            </div>

            {job.crew_lead?.full_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>{job.crew_lead.full_name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {value > 0 && (
            <span className="text-lg font-bold text-foreground">
              ${value.toLocaleString()}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
