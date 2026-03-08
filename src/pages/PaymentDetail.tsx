import { CreditCard, Receipt, CheckCircle, Clock, DollarSign } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

// Demo data - will be replaced with real data
const demoPayments: Record<string, {
  id: string;
  customerName: string;
  jobName?: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  transactionRef?: string;
  receiptUrl?: string;
  createdAt: string;
  notes?: string;
}> = {
  "pay-1": {
    id: "pay-1",
    customerName: "Thompson Estate",
    jobName: "Full Landscape",
    invoiceId: "inv-2",
    amount: 31616,
    method: "ach",
    status: "completed",
    transactionRef: "ACH-2024-0103-001",
    receiptUrl: "#",
    createdAt: "Jan 3, 2024",
    notes: "Final payment for landscape project",
  },
  "pay-2": {
    id: "pay-2",
    customerName: "Chen Residence",
    jobName: "Retaining Wall",
    invoiceId: "inv-3",
    amount: 2764.80,
    method: "card",
    status: "completed",
    transactionRef: "CC-2024-0108-002",
    receiptUrl: "#",
    createdAt: "Jan 8, 2024",
  },
  "pay-3": {
    id: "pay-3",
    customerName: "Adams Home",
    invoiceId: "inv-5",
    amount: 1500,
    method: "cash",
    status: "completed",
    createdAt: "Jan 10, 2024",
  },
  "pay-4": {
    id: "pay-4",
    customerName: "Baker Landscaping",
    invoiceId: "inv-6",
    amount: 3200,
    method: "tap-to-pay",
    status: "completed",
    transactionRef: "TAP-2024-0112-001",
    receiptUrl: "#",
    createdAt: "Jan 12, 2024",
  },
};

const methodLabels: Record<string, string> = {
  card: "Credit Card",
  ach: "Bank Transfer (ACH)",
  cash: "Cash",
  check: "Check",
  "tap-to-pay": "Tap to Pay",
  other: "Other",
};

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  completed: { color: "bg-status-confirmed-bg text-status-confirmed", icon: CheckCircle },
  pending: { color: "bg-status-pending-bg text-status-pending", icon: Clock },
  failed: { color: "bg-status-attention-bg text-status-attention", icon: Clock },
};

export default function PaymentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const payment = demoPayments[id || "pay-1"];

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

  const StatusIcon = statusConfig[payment.status]?.icon || Clock;

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
                  ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">{payment.createdAt}</p>
              </div>
            </div>
            <Badge className={cn("capitalize", statusConfig[payment.status]?.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {payment.status}
            </Badge>
          </div>
        </div>

        {/* Customer & Job */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Details</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="text-foreground font-medium">{payment.customerName}</span>
            </div>
            {payment.jobName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Job</span>
                <span className="text-foreground">{payment.jobName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="text-foreground">{methodLabels[payment.method]}</span>
            </div>
            {payment.transactionRef && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="text-foreground font-mono text-xs">{payment.transactionRef}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {payment.notes && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="font-semibold text-foreground mb-2">Notes</h2>
            <p className="text-sm text-muted-foreground">{payment.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {payment.receiptUrl && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open(payment.receiptUrl, "_blank")}
            >
              <Receipt className="h-4 w-4" />
              View Receipt
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => navigate(`/payments/invoices/${payment.invoiceId}`)}
          >
            View Related Invoice
          </Button>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
