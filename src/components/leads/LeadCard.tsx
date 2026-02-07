import { useState } from "react";
import { Phone, MessageSquare, CheckCircle, FileText, ChevronRight, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type LeadStatus = "new" | "contacted" | "qualified" | "job" | "paid" | "completed";

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
  onQualify?: () => void;
  onViewEstimate?: () => void;
  className?: string;
}

export function LeadCard({ lead, onClick, onCall, onMessage, onQualify, onViewEstimate, className }: LeadCardProps) {
  const [showQualifyConfirm, setShowQualifyConfirm] = useState(false);
  const isQualifiedOrBeyond = lead.status === "qualified" || lead.status === "job" || lead.status === "paid" || lead.status === "completed";
  const getStatusBadgeStatus = (status: LeadStatus) => {
    switch (status) {
      case "qualified":
      case "job":
      case "paid":
      case "completed":
        return "confirmed";
      case "new":
      case "contacted":
        return "pending";
      default:
        return "pending";
    }
  };

  const statusLabels: Record<LeadStatus, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    paid: "Paid",
    completed: "Completed",
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
              {lead.serviceType && lead.serviceType !== "Unknown" ? lead.serviceType : "No service type"}
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
        {isQualifiedOrBeyond ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewEstimate?.();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
          >
            <FileText className="h-4 w-4" />
            View Estimate
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowQualifyConfirm(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
          >
            <CheckCircle className="h-4 w-4" />
            Qualify
          </button>
        )}
      </div>

      <AlertDialog open={showQualifyConfirm} onOpenChange={setShowQualifyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Qualify Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to qualify <span className="font-medium text-foreground">{lead.name}</span>? This will move the lead to the qualified stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowQualifyConfirm(false);
                onQualify?.();
              }}
            >
              Qualify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
