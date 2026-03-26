// @ts-nocheck
import { useState } from "react";
import { MapPin, Clock, Phone, Navigation, MessageSquare, Calendar, User, ChevronRight, Users, Repeat, DollarSign, PersonStanding, Briefcase } from "lucide-react";
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
  onCall?: () => void;
  onMessage?: () => void;
  onNavigate?: () => void;
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

export function JobCard({ job, onClick, onCall, onMessage, onNavigate, className }: JobCardProps) {
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
  const value = Number(job.estimate_total) || 0;

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

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <>
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "w-full text-left card-elevated rounded-lg transition-all",
          "active:scale-[0.98] hover:shadow-md",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          className
        )}
      >

        {/*Badge Div*/}
        <div className="flex justify-between px-8 py-4 pb-0">

            <Badge 
            className="gap-2"
            variant="outline"
            > 
                <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>{scheduledDateTime}</span>
            </Badge>

            

          <div className="flex items-center gap-2 flex-wrap">
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
            {job.status === "completed" && !job.has_invoice && !job.is_estimate_visit && (
              <Badge variant="outline" className="text-xs border-orange-300 bg-orange-50 text-orange-700">
                <DollarSign className="h-3 w-3 mr-1" />
                Needs Invoice: ${value > 0 ? value.toLocaleString() : "0"}
              </Badge>
            )}
          </div>
  
        </div>
        
        {/*Content Div*/}
        <div className="px-8 pb-4 pt-2 flex flex-col gap-2">
                <h3 className="flex-1 text-2 truncate">
                    {job.name || "Unnamed Job"}
                </h3>
                
                <div className="flex flex-col">
                {job.customer?.name && (
                  <div
                    className="flex gap-2 items-center text-sm text-muted-foreground transition-colors"
                  >
                    <User className="w-4 h-4"></User>
                    <p>{job.customer.name}</p>
                  </div>
                )}

                 <div
                    className="flex gap-2 items-center text-sm text-muted-foreground transition-colors"
                  >
                    <Briefcase className="w-4 h-4"></Briefcase>
                    <p className="text-sm text-muted-foreground font-medium">
                    {job.is_estimate_visit
                      ? `${job.service_type || "No service type"}, Estimate`
                      : job.service_type || "No service type"}
                    </p>
                  </div>

                
                </div>

        </div>

        {/*Action Buttons*/}
        <div className="flex border-t border-border">

                  <button
                    type="button"
                    aria-label="Call"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCall?.();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <Phone className="h-4 w-4" />

                  </button>
                  <div className="w-px bg-border" />
                  <button
                    type="button"
                    aria-label="Message"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessage?.();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <MessageSquare className="h-4 w-4" />

                  </button>
                  <div className="w-px bg-border" />
                  <button
                    type="button"
                    aria-label="Navigate"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNavigate) {
                        onNavigate();
                        return;
                      }
                      const destinationAddress = address || "";
                      if (!destinationAddress) return;
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`,
                        "_blank"
                      );
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <Navigation className="h-4 w-4" />

                  </button>


        </div>

      </div>

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
