import { FileText, Eye, Check, Clock, AlertCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Invoice, InvoiceStatus } from "@/types/payments";

interface InvoiceCardProps {
  invoice: Invoice;
  onClick?: () => void;
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", className: "status-pending", icon: <Clock className="h-3 w-3" /> },
  viewed: { label: "Viewed", className: "status-paid", icon: <Eye className="h-3 w-3" /> },
  partial: { label: "Partial", className: "status-pending", icon: <DollarSign className="h-3 w-3" /> },
  paid: { label: "Paid", className: "status-confirmed", icon: <Check className="h-3 w-3" /> },
  overdue: { label: "Overdue", className: "status-attention", icon: <AlertCircle className="h-3 w-3" /> },
};

export function InvoiceCard({ invoice, onClick }: InvoiceCardProps) {
  const config = statusConfig[invoice.status];
  const hasBalance = invoice.balanceDue > 0 && invoice.balanceDue < invoice.total;

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
            {invoice.status === 'overdue' && (
              <span className="text-2xs text-[hsl(var(--status-attention))]">
                Overdue
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{invoice.customerName}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {invoice.jobName || "No job assigned"}
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Due {invoice.dueDate}
          </p>
        </div>
        <div className="text-right ml-3">
          <p className="text-lg font-bold text-foreground">
            ${invoice.total.toLocaleString()}
          </p>
          {hasBalance && (
            <p className="text-sm text-[hsl(var(--status-pending))]">
              ${invoice.balanceDue.toLocaleString()} due
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
