import { CreditCard, Banknote, Building2, Smartphone, Check, Clock, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Payment, PaymentMethod, PaymentStatus } from "@/types/payments";

interface PaymentCardProps {
  payment: Payment;
  onClick?: () => void;
}

const methodIcons: Record<PaymentMethod, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  ach: <Building2 className="h-4 w-4" />,
  'tap-to-pay': <Smartphone className="h-4 w-4" />,
};

const methodLabels: Record<PaymentMethod, string> = {
  card: "Card",
  cash: "Cash",
  check: "Check",
  ach: "ACH Transfer",
  'tap-to-pay': "Tap to Pay",
};

const statusConfig: Record<PaymentStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", className: "status-pending", icon: <Clock className="h-3 w-3" /> },
  completed: { label: "Completed", className: "status-confirmed", icon: <Check className="h-3 w-3" /> },
  failed: { label: "Failed", className: "status-attention", icon: <XCircle className="h-3 w-3" /> },
  refunded: { label: "Refunded", className: "bg-secondary text-secondary-foreground", icon: <RotateCcw className="h-3 w-3" /> },
};

import { FileText } from "lucide-react";

export function PaymentCard({ payment, onClick }: PaymentCardProps) {
  const statusCfg = statusConfig[payment.status];

  return (
    <button
      onClick={onClick}
      className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            {methodIcons[payment.method]}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{payment.customerName}</h3>
            <p className="text-sm text-muted-foreground">
              {methodLabels[payment.method]}
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              {payment.createdAt}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-foreground">
            ${payment.amount.toLocaleString()}
          </p>
          <span className={cn("text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1", statusCfg.className)}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>
      </div>
    </button>
  );
}
