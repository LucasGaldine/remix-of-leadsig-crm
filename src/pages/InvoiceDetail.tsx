import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Send,
  CreditCard,
  Link2,
  Copy,
  Trash2,
  User,
  Calendar,
  ChevronRight,
  DollarSign,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Invoice, InvoiceStatus, Payment } from "@/types/payments";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { toast } from "sonner";

// Demo invoice data
const invoiceData: Invoice = {
  id: "inv-1",
  customerId: "cust-4",
  customerName: "Martinez Backyard",
  jobId: "job-4",
  jobName: "Walkway Installation",
  lineItems: [
    { id: "li-1", name: "Bluestone Pavers", description: "Natural cleft bluestone, irregular pattern", qty: 150, unit: "sq ft", unitPrice: 20, total: 3000 },
    { id: "li-2", name: "Base Preparation", description: "Excavation and gravel base", qty: 1, unit: "job", unitPrice: 800, total: 800 },
    { id: "li-3", name: "Installation Labor", description: "Professional installation", qty: 16, unit: "hours", unitPrice: 75, total: 1200 },
    { id: "li-4", name: "Joint Sand", description: "Polymeric jointing sand", qty: 5, unit: "bags", unitPrice: 40, total: 200 },
  ],
  subtotal: 5200,
  taxRate: 0.08,
  tax: 416,
  discount: 0,
  total: 5616,
  balanceDue: 5616,
  status: "sent",
  dueDate: "Jan 20, 2025",
  createdAt: "Jan 6, 2025",
  sentAt: "Jan 6, 2025",
};

const paymentHistory: Payment[] = [
  // No payments yet for this invoice
];

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", className: "status-pending" },
  viewed: { label: "Viewed", className: "status-paid" },
  partial: { label: "Partial", className: "status-pending" },
  paid: { label: "Paid", className: "status-confirmed" },
  overdue: { label: "Overdue", className: "status-attention" },
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice] = useState(invoiceData);
  const [payments] = useState(paymentHistory);
  const [sendingPayLink, setSendingPayLink] = useState(false);
  const { isReady: stripeReady, createPaymentSession, startOnboarding } = useStripeConnect();

  const config = statusConfig[invoice.status];
  const isPaid = invoice.status === "paid";
  const hasBalance = invoice.balanceDue > 0;

  const handleSend = () => {
    if (import.meta.env.DEV) {
      console.log("Sending invoice via email/SMS...");
    }
  };

  const handleChargeNow = async () => {
    if (!stripeReady) {
      navigate("/payments/charge", { state: { invoice } });
      return;
    }

    setSendingPayLink(true);
    try {
      const result = await createPaymentSession({
        amount: invoice.balanceDue,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        customerEmail: "customer@example.com", // Would come from real data
        customerName: invoice.customerName,
        description: `Invoice for ${invoice.jobName}`,
        jobId: invoice.jobId,
      });

      if (result?.url) {
        window.open(result.url, "_blank");
        toast.success("Payment page opened");
      }
    } finally {
      setSendingPayLink(false);
    }
  };

  const handleCopyPayLink = () => {
    const payLink = `https://pay.example.com/invoice/${invoice.id}`;
    navigator.clipboard.writeText(payLink);
    toast.success("Pay link copied to clipboard");
  };

  const handleDuplicate = () => {
    navigate("/payments/invoices/new", { state: { duplicate: invoice } });
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Invoice" showBack backTo="/payments" />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className={cn("text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.label}
            </span>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {invoice.customerName}
            </h2>
            <p className="text-muted-foreground">{invoice.jobName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${invoice.total.toLocaleString()}
            </p>
            {hasBalance && (
              <p className="text-sm text-[hsl(var(--status-pending))]">
                ${invoice.balanceDue.toLocaleString()} due
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Customer & Due Date Info */}
      <div className="px-4 py-4 space-y-3">
        <button className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Customer</p>
              <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>

        <div className="card-elevated rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Calendar className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Due Date</p>
              <p className={cn(
                "text-sm",
                invoice.status === "overdue" ? "text-[hsl(var(--status-attention))]" : "text-muted-foreground"
              )}>
                {invoice.dueDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Line Items</h3>
        <div className="card-elevated rounded-lg overflow-hidden">
          {invoice.lineItems.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "p-4",
                index < invoice.lineItems.length - 1 && "border-b border-border"
              )}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.qty} {item.unit} × ${item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-foreground ml-4">
                  ${item.total.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="px-4 mt-4">
        <div className="card-elevated rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${invoice.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({(invoice.taxRate * 100).toFixed(0)}%)</span>
            <span className="text-foreground">${invoice.tax.toLocaleString()}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-[hsl(var(--status-confirmed))]">-${invoice.discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-lg text-foreground">${invoice.total.toLocaleString()}</span>
          </div>
          {hasBalance && invoice.balanceDue !== invoice.total && (
            <>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-[hsl(var(--status-confirmed))]">
                  -${(invoice.total - invoice.balanceDue).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Balance Due</span>
                <span className="font-bold text-lg text-[hsl(var(--status-pending))]">
                  ${invoice.balanceDue.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold text-foreground mb-3">Payment History</h3>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="card-elevated rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[hsl(var(--status-confirmed-bg))]">
                      <DollarSign className="h-4 w-4 text-[hsl(var(--status-confirmed))]" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">${payment.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{payment.createdAt}</p>
                    </div>
                  </div>
                  <span className="status-confirmed text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleCopyPayLink}>
            <Link2 className="h-4 w-4" />
            Copy Pay Link
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-14 gap-2" onClick={handleSend}>
            <Send className="h-4 w-4" />
            Send
          </Button>
          {hasBalance && (
            <Button 
              className="flex-1 h-14 gap-2" 
              onClick={handleChargeNow}
              disabled={sendingPayLink}
            >
              {sendingPayLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : stripeReady ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {stripeReady ? "Charge Now" : "Charge Now"}
            </Button>
          )}
        </div>
        {hasBalance && !stripeReady && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            <button 
              className="text-primary hover:underline" 
              onClick={() => startOnboarding()}
            >
              Connect Stripe
            </button>
            {" "}to accept card payments
          </p>
        )}
      </div>

      <MobileNav />
    </div>
  );
}
