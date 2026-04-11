import { Receipt } from "lucide-react";
import { Invoice, InvoiceStatus } from "@/types/payments";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";

interface InvoiceCardProps {
  invoice: Invoice;
  onClick?: () => void;
  className?: string;
}

const statusConfig: Record<InvoiceStatus, { label: string; tone: ActivityTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "pending" },
  viewed: { label: "Viewed", tone: "pending" },
  partial: { label: "Partial", tone: "pending" },
  paid: { label: "Paid", tone: "confirmed" },
  overdue: { label: "Late", tone: "attention" },
};

export function InvoiceCard({ invoice, onClick, className }: InvoiceCardProps) {
  const config = statusConfig[invoice.status];
  const subtitle = `Due ${invoice.dueDate} | $${invoice.total.toLocaleString()} | ${invoice.jobName || "No job assigned"}`;

  return (
    <UnifiedActivityCard
      icon={<Receipt className="h-5 w-5 text-indigo-600" />}
      title={invoice.customerName || "Invoice"}
      subtitle={subtitle}
      statusLabel={config.label}
      tone={config.tone}
      onClick={onClick}
      className={className}
    />
  );
}
