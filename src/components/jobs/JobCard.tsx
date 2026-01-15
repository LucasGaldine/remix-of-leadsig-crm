import { MapPin, Clock, User, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["job_status"];
type DbJob = Database["public"]["Tables"]["jobs"]["Row"];

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
}

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
}

function formatScheduledTime(date: string | null, timeStart: string | null): string {
  if (!date) return "Not scheduled";

  const jobDate = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = jobDate.toDateString() === today.toDateString();
  const isTomorrow = jobDate.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return timeStart ? `Today, ${timeStart.slice(0, 5)}` : "Today";
  } else if (isTomorrow) {
    return timeStart ? `Tomorrow, ${timeStart.slice(0, 5)}` : "Tomorrow";
  } else {
    return jobDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export function JobCard({ job, onClick, className }: JobCardProps) {
  const statusLabels: Record<JobStatus, string> = {
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    invoiced: "Invoiced",
    paid: "Paid",
  };

  const scheduledTime = formatScheduledTime(job.scheduled_date, job.scheduled_time_start);
  const address = job.address || job.customer?.address || "No address";
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
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status}>
              {statusLabels[job.status]}
            </StatusBadge>
          </div>

          <h3 className="font-semibold text-foreground truncate text-lg">
            {job.customer?.name || job.name}
          </h3>

          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {job.service_type || "No service type"}
          </p>

          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{scheduledTime}</span>
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
