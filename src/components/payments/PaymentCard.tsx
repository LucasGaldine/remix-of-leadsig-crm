import { CreditCard, Banknote, Building2, Smartphone, Check, Clock, XCircle, RotateCcw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Payment, PaymentMethod } from "@/types/payments";
import { getPaymentMethodLabel, getPaymentStatusDisplay } from "@/lib/paymentPresentation";

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

export function PaymentCard({ payment, onClick }: PaymentCardProps) {
  const statusDisplay = getPaymentStatusDisplay(
    payment.status,
    payment.terminalStatus,
    payment.paymentChannel,
  );
  const statusCfg = {
    label: statusDisplay.label,
    className:
      statusDisplay.tone === "confirmed"
        ? "status-confirmed"
        : statusDisplay.tone === "attention"
          ? "status-attention"
          : statusDisplay.tone === "neutral"
            ? "bg-secondary text-secondary-foreground"
            : "status-pending",
    icon:
      statusDisplay.icon === "check"
        ? <Check className="h-3 w-3" />
        : statusDisplay.icon === "x-circle"
          ? <XCircle className="h-3 w-3" />
          : statusDisplay.icon === "rotate-ccw"
            ? <RotateCcw className="h-3 w-3" />
            : <Clock className="h-3 w-3" />,
  };

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
              {getPaymentMethodLabel(payment.method)}
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
