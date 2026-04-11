import type { ReactNode } from "react";
import { FileText, Receipt, Check, Clock, AlertCircle, XCircle } from "lucide-react";
import { Estimate } from "@/types/payments";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";

interface EstimateCardProps {
  estimate: Estimate & { isFinalized?: boolean; needsReview?: boolean };
  onClick?: () => void;
  className?: string;
}

function getDisplayConfig(estimate: Estimate & { isFinalized?: boolean; needsReview?: boolean }): {
  label: string;
  tone: ActivityTone;
  icon: ReactNode;
} {
  if (estimate.needsReview) {
    return { label: "Visit Complete", tone: "attention", icon: <AlertCircle className="h-5 w-5 text-amber-600" /> };
  }
  if (estimate.isFinalized) {
    return { label: "Invoiced", tone: "confirmed", icon: <Receipt className="h-5 w-5 text-amber-600" /> };
  }
  if (estimate.status === "accepted") {
    return { label: "Approved", tone: "confirmed", icon: <Check className="h-5 w-5 text-amber-600" /> };
  }
  if (estimate.status === "declined") {
    return { label: "Declined", tone: "attention", icon: <XCircle className="h-5 w-5 text-amber-600" /> };
  }
  if (estimate.status === "expired") {
    return { label: "Expired", tone: "attention", icon: <AlertCircle className="h-5 w-5 text-amber-600" /> };
  }
  if (estimate.status === "sent" || estimate.status === "viewed") {
    return { label: "Not Approved", tone: "pending", icon: <Clock className="h-5 w-5 text-amber-600" /> };
  }
  return { label: "Draft", tone: "neutral", icon: <FileText className="h-5 w-5 text-amber-600" /> };
}

export function EstimateCard({ estimate, onClick, className }: EstimateCardProps) {
  const config = getDisplayConfig(estimate);
  const subtitle = `${estimate.createdAt} | $${estimate.total.toLocaleString()} | ${estimate.jobName || "No job assigned"}`;

  return (
    <UnifiedActivityCard
      icon={config.icon}
      title={estimate.customerName || "Estimate"}
      subtitle={subtitle}
      statusLabel={config.label}
      tone={config.tone}
      onClick={onClick}
      className={className}
    />
  );
}
