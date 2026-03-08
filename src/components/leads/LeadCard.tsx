import { useState } from "react";
import { Phone, MessageSquare, ChevronRight, ArchiveRestore, Trash2, Navigation } from "lucide-react";
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

export type LeadStatus = "new" | "contacted" | "qualified" | "job" | "paid" | "completed" | "lost" | "archived";

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
  archiveMode?: boolean;
  onUnarchive?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function LeadCard({ lead, onClick, onCall, onMessage, onQualify, onViewEstimate, archiveMode, onUnarchive, onDelete, className }: LeadCardProps) {
  const [showQualifyConfirm, setShowQualifyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isQualifiedOrBeyond = lead.status === "qualified" || lead.status === "job" || lead.status === "paid" || lead.status === "completed";
  const getStatusBadgeStatus = (status: LeadStatus) => {
    switch (status) {
      case "qualified":
      case "job":
      case "paid":
      case "completed":
        return "confirmed";
      case "lost":
        return "attention";
      case "archived":
        return "pending";
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
    lost: "Lost",
    archived: "Archived",
  };

  return (
    <div
      className={cn(
        "card-elevated rounded-lg overflow-hidden levitate",
        className
      )}
    >
      <button
        onClick={onClick}
        className="w-full text-left p-4 transition-all active:bg-muted/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={getStatusBadgeStatus(lead.status)}>
                {statusLabels[lead.status]}
              </StatusBadge>
              <span className="text-2xs text-muted-foreground uppercase tracking-wide">
                via {lead.source}
              </span>

            </div>

            <p className="text-2">
              {lead.name}
            </p>

            <p className="text-5 font-medium mt-0.5">
              {lead.serviceType && lead.serviceType !== "Unknown" ? lead.serviceType : "No service type"}
            </p>

          </div>

           <span className="text-2">
                ${lead.estimatedBudget.toLocaleString()}
              </span>

          <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
        </div>
      </button>

      <div className="flex border-t border-border">
        {archiveMode ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnarchive?.();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
            >
              <ArchiveRestore className="h-4 w-4" />
              Unarchive
            </button>
            <div className="w-px bg-border" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors min-h-touch"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </>
        ) : (
          <>
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
          </>
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <span className="font-medium text-foreground">{lead.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
