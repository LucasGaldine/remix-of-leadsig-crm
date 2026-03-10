// @ts-nocheck
import { useState } from "react";
import { MapPin, Clock, User, ChevronRight, Users, Repeat, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database";
import { format } from "date-fns";
import { RecurringJobDetailModal } from "./RecurringJobDetailModal";
import { useNavigate } from "react-router-dom";

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
  recurring_job_id?: string | null;
  recurring_instance_number?: number | null;
  has_invoice?: boolean;
  estimate_total?: number | null;
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
  const navigate = useNavigate();
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  const statusLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
  };

  const badgeStatus = (job.display_status || job.status) as string;
  const isUnassigned = (job.crew_count || 0) === 0 && (badgeStatus === "unscheduled" || badgeStatus === "scheduled" || badgeStatus === "in_progress");
  const scheduledDateTime = formatScheduledDateRange(job.scheduled_date, job.last_scheduled_date);
  const address = [job.address, job.city].filter(Boolean).join(", ") || job.customer?.address || "No address";
  const value = Number(job.actual_value) || Number(job.estimated_value);

  const handleRecurringBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRecurringModal(true);
  };

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.customer?.id) {
      navigate(`/customers/${job.customer.id}`);
    }
  };

  return (
    <>
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
              {job.recurring_job_id && (
                <Badge
                  variant="outline"
                  className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100 transition-colors"
                  onClick={handleRecurringBadgeClick}
                >
                  <Repeat className="h-3 w-3 mr-1" />
                  Recurring
                </Badge>
              )}
              {isUnassigned && (
                <Badge variant="outline" className="text-xs border-red-300 bg-red-50 text-red-700">
                  <Users className="h-3 w-3 mr-1" />
                  Unassigned
                </Badge>
              )}
              {job.status === "completed" && !job.has_invoice && (
                <Badge variant="outline" className="text-xs border-orange-300 bg-orange-50 text-orange-700">
                  <DollarSign className="h-3 w-3 mr-1" />
                  Needs Invoice: ${job.estimate_total ? job.estimate_total.toLocaleString() : (value > 0 ? value.toLocaleString() : "0")}
                </Badge>
              )}
            </div>

          <h3 className="text-2 truncate">
            {job.name || "Unnamed Job"}
          </h3>

          {job.customer?.name && (
            <button
              onClick={handleCustomerClick}
              className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors mt-0.5 text-left"
            >
              {job.customer.name}
            </button>
          )}

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

        <div className="flex items-center gap-4">
          {value > 0 && (
            <span className="text-2">
              ${value.toLocaleString()}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>

      </div>
      </button>

      {job.recurring_job_id && (
        <RecurringJobDetailModal
          open={showRecurringModal}
          onOpenChange={setShowRecurringModal}
          recurringJobId={job.recurring_job_id}
          jobId={job.id}
          onMadeUnique={() => {
            onClick?.();
          }}
        />
      )}
    </>
  );
}
