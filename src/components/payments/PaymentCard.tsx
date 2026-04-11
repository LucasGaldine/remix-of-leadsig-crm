import type { ReactNode } from "react";
import { CreditCard, Banknote, Building2, Smartphone, FileText } from "lucide-react";
import { Payment, PaymentMethod } from "@/types/payments";
import { getPaymentMethodLabel, getPaymentStatusDisplay } from "@/lib/paymentPresentation";
import { UnifiedActivityCard, type ActivityTone } from "@/components/activity/UnifiedActivityCard";

interface PaymentCardProps {
  payment: Payment;
  onClick?: () => void;
  className?: string;
}

const methodIcons: Record<PaymentMethod, ReactNode> = {
  card: <CreditCard className="h-5 w-5 text-violet-600" />,
  cash: <Banknote className="h-5 w-5 text-violet-600" />,
  check: <FileText className="h-5 w-5 text-violet-600" />,
  ach: <Building2 className="h-5 w-5 text-violet-600" />,
  "tap-to-pay": <Smartphone className="h-5 w-5 text-violet-600" />,
};

function mapTone(tone: "confirmed" | "attention" | "neutral" | "pending"): ActivityTone {
  return tone;
}

export function PaymentCard({ payment, onClick, className }: PaymentCardProps) {
  const statusDisplay = getPaymentStatusDisplay(payment.status, payment.terminalStatus, payment.paymentChannel);
  const subtitle = `${payment.createdAt} | ${getPaymentMethodLabel(payment.method)} | $${payment.amount.toLocaleString()}`;

  return (
    <UnifiedActivityCard
      icon={methodIcons[payment.method]}
      title={payment.customerName}
      subtitle={subtitle}
      statusLabel={statusDisplay.label}
      tone={mapTone(statusDisplay.tone)}
      onClick={onClick}
      className={className}
    />
  );
}
