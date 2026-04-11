import { Magnet, MessageSquare, Navigation, Phone } from "lucide-react";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";

export type LeadStatus = "new" | "contacted" | "qualified" | "job" | "paid" | "completed" | "lost" | "cancelled" | "archived";

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
  isJob?: boolean;
}

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  onNavigate?: () => void;
  showQuickActions?: boolean;
  onQualify?: () => void;
  onViewEstimate?: () => void;
  archiveMode?: boolean;
  onUnarchive?: () => void;
  onDelete?: () => void;
  className?: string;
}

const statusConfig: Record<LeadStatus, { label: string; tone: ActivityTone }> = {
  new: { label: "New", tone: "neutral" },
  contacted: { label: "Contacted", tone: "pending" },
  qualified: { label: "Qualified", tone: "confirmed" },
  job: { label: "Job", tone: "confirmed" },
  paid: { label: "Paid", tone: "confirmed" },
  completed: { label: "Completed", tone: "confirmed" },
  lost: { label: "Lost", tone: "attention" },
  cancelled: { label: "Canceled", tone: "attention" },
  archived: { label: "Archived", tone: "neutral" },
};

export function LeadCard({ lead, onClick, onCall, onMessage, onNavigate, showQuickActions = false, className }: LeadCardProps) {
  const status = statusConfig[lead.status] || statusConfig.new;
  const subtitle = `${lead.createdAt} | ${lead.serviceType && lead.serviceType !== "Unknown" ? lead.serviceType : "No service type"}`;

  return (
    <UnifiedActivityCard
      icon={<Magnet className="h-5 w-5 text-sky-600" />}
      title={lead.name || "Unnamed Lead"}
      subtitle={subtitle}
      statusLabel={status.label}
      tone={status.tone}
      onClick={onClick}
      quickActions={
        showQuickActions
          ? [
              { label: "Call", icon: <Phone className="h-4 w-4" />, onClick: onCall, disabled: !onCall },
              { label: "Text", icon: <MessageSquare className="h-4 w-4" />, onClick: onMessage, disabled: !onMessage },
              { label: "Navigate", icon: <Navigation className="h-4 w-4" />, onClick: onNavigate, disabled: !onNavigate },
            ]
          : []
      }
      className={className}
    />
  );
}
