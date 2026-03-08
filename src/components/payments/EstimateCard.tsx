// @ts-nocheck
import { FileText, Check, Clock, AlertCircle, Receipt, XCircle, ClipboardCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Estimate } from "@/types/payments";

interface EstimateCardProps {
  estimate: Estimate & { isFinalized?: boolean; needsReview?: boolean };
  onClick?: () => void;
}

function getDisplayConfig(estimate: Estimate & { isFinalized?: boolean }) {
  if (estimate.isFinalized) {
    return { label: "Invoiced", className: "status-paid", icon: <Receipt className="h-3 w-3" /> };
  }
  if (estimate.status === "accepted") {
    return { label: "Approved", className: "status-confirmed", icon: <Check className="h-3 w-3" /> };
  }
  if (estimate.status === "declined") {
    return { label: "Declined", className: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> };
  }
  if (estimate.status === "expired") {
    return { label: "Expired", className: "status-attention", icon: <AlertCircle className="h-3 w-3" /> };
  }
  if (estimate.status === "sent" || estimate.status === "viewed") {
    return { label: "Not Approved", className: "status-pending", icon: <Clock className="h-3 w-3" /> };
  }
  return { label: "Not Approved", className: "bg-secondary text-secondary-foreground", icon: <FileText className="h-3 w-3" /> };
}

export function EstimateCard({ estimate, onClick }: EstimateCardProps) {
  const config = getDisplayConfig(estimate);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all",
        estimate.needsReview && "ring-1 ring-amber-400/50"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.icon}
              {config.label}
            </span>
            {estimate.needsReview && (
              <span className="text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-100 text-amber-800">
                <ClipboardCheck className="h-3 w-3" />
                Visit Complete
              </span>
            )}
          </div>
          
         
          <p className="text-2">
            {estimate.jobName || "No job assigned"}
           </p>
            
          <div className="flex flex-col text-5 gap-1 mt-2">
            <p>
              {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
            </p>

            <p>
              Created {estimate.createdAt}
            </p>
          </div>

        </div>

         <div className="flex gap-4 items-center text-right ml-3">
          <p className="text-2">
            ${estimate.total.toLocaleString()}
          </p>


          {estimate.expiresAt && (
            <p className="text-2xs text-muted-foreground">
              Expires {estimate.expiresAt}
            </p>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>

      </div>
    </button>
  );
}
