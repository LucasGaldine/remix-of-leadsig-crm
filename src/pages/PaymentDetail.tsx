import { Receipt, CheckCircle, Clock, DollarSign, XCircle, RotateCcw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { usePayment } from "@/hooks/usePayments";
import { format } from "date-fns";
import { getPaymentMethodLabel, getPaymentStatusDisplay } from "@/lib/paymentPresentation";

export default function PaymentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: payment, isLoading } = usePayment(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Payment not found</p>
          <Button onClick={() => navigate("/payments")}>Back to Payments</Button>
        </div>
      </div>
    );
  }

  const statusDisplay = getPaymentStatusDisplay(
    payment.status,
    payment.stripe_terminal_payment_intent_status || undefined,
    payment.payment_channel || undefined,
  );
  const statusColor =
    statusDisplay.tone === "confirmed"
      ? "bg-status-confirmed-bg text-status-confirmed"
      : statusDisplay.tone === "attention"
        ? "bg-status-attention-bg text-status-attention"
        : statusDisplay.tone === "neutral"
          ? "bg-secondary text-secondary-foreground"
          : "bg-status-pending-bg text-status-pending";
  const StatusIcon =
    statusDisplay.icon === "check"
      ? CheckCircle
      : statusDisplay.icon === "x-circle"
        ? XCircle
        : statusDisplay.icon === "rotate-ccw"
          ? RotateCcw
          : Clock;
  const createdAt = payment.created_at ? format(new Date(payment.created_at), "MMM d, yyyy") : "";
  const methodLabel = getPaymentMethodLabel(payment.method);

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Payment Details" showBack backTo="/payments" />

      <main className="px-4 py-4 space-y-4">
        {/* Payment Summary */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-status-confirmed-bg">
                <DollarSign className="h-6 w-6 text-status-confirmed" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">{createdAt}</p>
              </div>
            </div>
            <Badge className={cn(statusColor)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusDisplay.label}
            </Badge>
          </div>
        </div>

        {/* Customer & Job */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Details</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="text-foreground font-medium">{payment.customer?.name || "Unknown"}</span>
            </div>
            {payment.job?.name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Job</span>
                <span className="text-foreground">{payment.job.name}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="text-foreground">{methodLabel}</span>
            </div>
            {(payment.payment_channel === "terminal" || payment.stripe_terminal_payment_intent_status) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Terminal Status</span>
                <span className="text-foreground">{statusDisplay.label}</span>
              </div>
            )}
            {payment.transaction_ref && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="text-foreground font-mono text-xs">{payment.transaction_ref}</span>
              </div>
            )}
            {payment.stripe_terminal_reader_id && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reader ID</span>
                <span className="text-foreground font-mono text-xs">{payment.stripe_terminal_reader_id}</span>
              </div>
            )}
            {payment.stripe_terminal_location_id && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location ID</span>
                <span className="text-foreground font-mono text-xs">{payment.stripe_terminal_location_id}</span>
              </div>
            )}
            {payment.stripe_payment_intent_id && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Intent</span>
                <span className="text-foreground font-mono text-xs">{payment.stripe_payment_intent_id}</span>
              </div>
            )}
          </div>
        </div>

        {payment.notes && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="font-semibold text-foreground mb-2">Notes</h2>
            <p className="text-sm text-muted-foreground">{payment.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {payment.receipt_url && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open(payment.receipt_url, "_blank")}
            >
              <Receipt className="h-4 w-4" />
              View Receipt
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => navigate(`/payments/invoices/${payment.invoice?.id || payment.invoice_id}`)}
          >
            View Related Invoice
          </Button>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
