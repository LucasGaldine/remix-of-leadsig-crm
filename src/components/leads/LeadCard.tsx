import { Phone, MessageSquare, Calendar, ChevronRight, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type LeadStatus = "new" | "contacted" | "qualified" | "scheduled" | "in_progress" | "won" | "lost" | "unqualified" | "converted" | "rejected";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  serviceType: string;
  estimatedBudget: number;
  location: string;
  source: string;
  createdAt: string;
  status: LeadStatus;
  qualificationScore?: number;
}

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  className?: string;
}

export function LeadCard({ lead, onClick, onCall, onMessage, className }: LeadCardProps) {
  const getStatusBadgeStatus = (status: LeadStatus) => {
    switch (status) {
      case "qualified":
      case "scheduled":
      case "won":
      case "converted":
        return "confirmed";
      case "new":
      case "contacted":
      case "in_progress":
        return "pending";
      case "rejected":
      case "lost":
      case "unqualified":
        return "attention";
      default:
        return "pending";
    }
  };

  const statusLabels: Record<LeadStatus, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    won: "Won",
    lost: "Lost",
    unqualified: "Unqualified",
    converted: "Converted",
    rejected: "Rejected",
  };

  return (
    <div
      className={cn(
        "card-elevated rounded-lg overflow-hidden",
        className
      )}
    >
      <button
        onClick={onClick}
        className="w-full text-left p-4 transition-all active:bg-muted/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={getStatusBadgeStatus(lead.status)}>
                {statusLabels[lead.status]}
              </StatusBadge>
              <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                via {lead.source}
              </span>
            </div>
            
            <h3 className="font-semibold text-foreground text-lg">
              {lead.name}
            </h3>
            
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              {lead.serviceType} • {lead.location}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="h-4 w-4 text-status-confirmed" />
              <span className="font-semibold text-foreground">
                ${lead.estimatedBudget.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">budget</span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
        </div>
      </button>

      {/* Quick action buttons - large touch targets */}
      <div className="flex border-t border-border">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCall?.();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
        >
          <Phone className="h-4 w-4" />
          Call
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMessage?.();
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
        >
          <MessageSquare className="h-4 w-4" />
          Text
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={onClick}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
        >
          <Calendar className="h-4 w-4" />
          Book
        </button>
      </div>
    </div>
  );
}
