import { FileText, Eye, Check, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Estimate, EstimateStatus } from "@/types/payments";

interface EstimateCardProps {
  estimate: Estimate;
  onClick?: () => void;
}

const statusConfig: Record<EstimateStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: "Estimate", className: "bg-blue-50 text-blue-600", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", className: "status-pending", icon: <Clock className="h-3 w-3" /> },
  viewed: { label: "Viewed", className: "status-paid", icon: <Eye className="h-3 w-3" /> },
  accepted: { label: "Approved", className: "status-confirmed", icon: <Check className="h-3 w-3" /> },
  expired: { label: "Expired", className: "status-attention", icon: <AlertCircle className="h-3 w-3" /> },
};

export function EstimateCard({ estimate, onClick }: EstimateCardProps) {
  const config = statusConfig[estimate.status];

  return (
    <button
      onClick={onClick}
      className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.icon}
              {config.label}
            </span>
          </div>
          <h3 className="font-semibold text-foreground truncate">{estimate.customerName}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {estimate.jobName || "No job assigned"}
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''} • Created {estimate.createdAt}
          </p>
        </div>
        <div className="text-right ml-3">
          <p className="text-lg font-bold text-foreground">
            ${estimate.total.toLocaleString()}
          </p>
          {estimate.expiresAt && (
            <p className="text-2xs text-muted-foreground">
              Expires {estimate.expiresAt}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
