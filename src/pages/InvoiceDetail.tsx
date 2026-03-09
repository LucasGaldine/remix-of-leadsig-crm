import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Link2,
  Copy,
  Trash2,
  User,
  Calendar,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvoiceStatus } from "@/types/payments";
import { useInvoice } from "@/hooks/useInvoices";
import { OtherPaymentOptionsModal, type PaymentOption } from "@/components/payments/OtherPaymentOptionsModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const [showChargeOptions, setShowChargeOptions] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Invoice" showBack backTo="/payments" />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Invoice" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Invoice not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const status = (invoice.status || "sent") as InvoiceStatus;
  const config = statusConfig[status] || statusConfig.sent;
  const total = Number(invoice.total || 0);
  const balanceDue = Number(invoice.balance_due || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const taxRate = Number(invoice.tax_rate || 0);
  const tax = Number(invoice.tax || 0);
  const discount = Number(invoice.discount || 0);
  const hasBalance = balanceDue > 0;
  const stripeInvoiceUrl = (invoice as any).stripe_invoice_url as string | null;
  const lineItems = invoice.line_items || [];

  const handleCopyPayLink = () => {
    const payLink = `${window.location.origin}/pay/invoice/${invoice.id}`;
    navigator.clipboard.writeText(payLink);
    toast.success("Pay link copied to clipboard");
  };

  const handleDuplicate = () => {
    navigate("/payments/invoices/new", { state: { duplicate: invoice } });
  };

  const handleRecordPayment = async (method: PaymentOption, amount: number) => {
    setRecordingPayment(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      await supabase.from("payments").insert({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        lead_id: invoice.lead_id,
        amount,
        method,
        status: "completed",
        processed_by: user?.id,
        account_id: invoice.account_id,
      });

      const newBalance = Math.max(0, balanceDue - amount);
      await supabase
        .from("invoices")
        .update({
          balance_due: newBalance,
          status: newBalance <= 0 ? "paid" : "partial",
          ...(newBalance <= 0 ? { paid_at: new Date().toISOString() } : {}),
        })
        .eq("id", invoice.id);

      await queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      setShowChargeOptions(false);
      toast.success(`${method.charAt(0).toUpperCase() + method.slice(1)} payment of $${amount.toLocaleString()} recorded`);
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Invoice" showBack backTo="/payments" />

      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className={cn("text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.label}
            </span>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {invoice.customer?.name || "Unknown"}
            </h2>
            <p className="text-muted-foreground">{invoice.job?.name || "No job"}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${total.toLocaleString()}
            </p>
            {hasBalance && (
              <p className="text-sm text-[hsl(var(--status-pending))]">
                ${balanceDue.toLocaleString()} due
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <button className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Customer</p>
              <p className="text-sm text-muted-foreground">{invoice.customer?.name || "Unknown"}</p>
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
                status === "overdue" ? "text-[hsl(var(--status-attention))]" : "text-muted-foreground"
              )}>
                {invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "Not set"}
              </p>
            </div>
          </div>
        </div>

        {stripeInvoiceUrl && (
          <a
            href={stripeInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-secondary">
              <CreditCard className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">View in Stripe</p>
              <p className="text-sm text-muted-foreground">Open invoice in Stripe Dashboard</p>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
        )}
      </div>

      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Line Items</h3>
        <div className="card-elevated rounded-lg overflow-hidden">
          {lineItems.length > 0 ? lineItems.map((item: any, index: number) => (
            <div
              key={item.id}
              className={cn(
                "p-4",
                index < lineItems.length - 1 && "border-b border-border"
              )}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.quantity} {item.unit} x ${Number(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-foreground ml-4">
                  ${Number(item.total).toLocaleString()}
                </p>
              </div>
            </div>
          )) : (
            <div className="p-4 text-center text-muted-foreground">No line items</div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="card-elevated rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(0)}%)</span>
            <span className="text-foreground">${tax.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-[hsl(var(--status-confirmed))]">-${discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-lg text-foreground">${total.toLocaleString()}</span>
          </div>
          {hasBalance && balanceDue !== total && (
            <>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-[hsl(var(--status-confirmed))]">
                  -${(total - balanceDue).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Balance Due</span>
                <span className="font-bold text-lg text-[hsl(var(--status-pending))]">
                  ${balanceDue.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 mb-4">
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

      {hasBalance && (
        <div className="px-4 mb-4">
          <Button
            className="w-full h-14 gap-2"
            onClick={() => setShowChargeOptions(true)}
          >
            <CreditCard className="h-4 w-4" />
            Charge Now
          </Button>
        </div>
      )}

      <OtherPaymentOptionsModal
        open={showChargeOptions}
        onOpenChange={setShowChargeOptions}
        totalAmount={balanceDue}
        onRecordPayment={handleRecordPayment}
        recordingPayment={recordingPayment}
      />

      <MobileNav />
    </div>
  );
}
