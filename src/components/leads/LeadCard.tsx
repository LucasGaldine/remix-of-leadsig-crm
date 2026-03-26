import { useState } from "react";
import { Phone, MessageSquare, Briefcase, ArchiveRestore, Trash2, Navigation, DollarSign, SquareArrowRight, Goal} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { useNavigate } from "react-router-dom";


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
  customer?: {
    id: string;
    name: string;
  } | null;
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
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.customer?.id) {
      navigate(`/customers/${lead.customer.id}`);
    }
  };

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
      <div
        onClick={onClick}
        className="w-full cursor-pointer hover:bg-accent/50 transition-colors"
      >

          <div className="flex flex-col">

            <div className="flex justify-between items-center px-8 pt-4">
                  
                  
                  <Badge
                  variant="outline"
                  className="gap-2"
                  >
                  <DollarSign className="w-3 h-3"></DollarSign>
                  <span>{lead.estimatedBudget.toLocaleString()}</span>
                  </Badge>
                  

                  

                <div className="flex gap-4 items-center">
                <StatusBadge status={getStatusBadgeStatus(lead.status)}>
                    {statusLabels[lead.status]}
                  </StatusBadge>


                  </div>

            </div>

            <div className="flex flex-col gap-1 px-8 pb-4 pt-1">
              <p className="text-2">
                {lead.name}
              </p>


              <div
              className="text-sm text-muted-foreground transition-colors"
              >
                <div
                    className="flex gap-2 items-center text-sm text-muted-foreground transition-colors"
                >
                  <Briefcase className="w-4 h-4"></Briefcase>
                  <p> {lead.serviceType && lead.serviceType !== "Unknown" ? lead.serviceType : "No service type"}</p>
                </div>

                <div
                    className="flex gap-2 items-center text-sm text-muted-foreground transition-colors"
                >
                  <SquareArrowRight className="w-4 h-4"></SquareArrowRight>
                  <p> Via {lead.source} </p>
                </div>
              </div>
              
            </div>

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

                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const address = lead.location || "";
                      if (address) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-accent active:bg-accent/80 transition-colors min-h-touch"
                  >
                    <Navigation className="h-4 w-4" />

                  </button>
                </>
              )}
            </div>

  

          </div>
      </div>

      



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
