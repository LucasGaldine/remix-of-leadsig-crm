import { MapPin, Clock, User, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type JobStatus = "scheduled" | "in-progress" | "completed" | "invoiced" | "paid";

export interface Job {
  id: string;
  clientName: string;
  clientAddress: string;
  serviceType: string;
  scheduledTime: string;
  status: JobStatus;
  crewLead?: string;
  estimateValue?: number;
}

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
}

export function JobCard({ job, onClick, className }: JobCardProps) {
  const statusLabels: Record<JobStatus, string> = {
    scheduled: "Scheduled",
    "in-progress": "In Progress",
    completed: "Completed",
    invoiced: "Invoiced",
    paid: "Paid",
  };

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
            {job.clientName}
          </h3>
          
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {job.serviceType}
          </p>

          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{job.clientAddress}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{job.scheduledTime}</span>
            </div>

            {job.crewLead && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>{job.crewLead}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {job.estimateValue && (
            <span className="text-lg font-bold text-foreground">
              ${job.estimateValue.toLocaleString()}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
