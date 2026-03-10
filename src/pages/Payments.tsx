import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, DollarSign, FileText, CreditCard, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Input } from "@/components/ui/input";
import { EstimateCard } from "@/components/payments/EstimateCard";
import { InvoiceCard } from "@/components/payments/InvoiceCard";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { cn } from "@/lib/utils";
import { useEstimates, EstimateWithDetails } from "@/hooks/useEstimates";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { format } from "date-fns";

type ActiveTab = "estimates" | "invoices" | "charge";
type AgingFilter = "all" | "0-7" | "8-30" | "31+";

export default function Payments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>("estimates");
  const [searchQuery, setSearchQuery] = useState("");
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(false);

  const { data: allEstimates = [], isLoading: estimatesLoading } = useEstimates({ limit: 100 });
  const { data: allInvoices = [], isLoading: invoicesLoading } = useInvoices({ limit: 100 });
  const { data: allPayments = [], isLoading: paymentsLoading } = usePayments({ limit: 100 });

  const isLoading = estimatesLoading || invoicesLoading || paymentsLoading;

  const totalCollected = allPayments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const allNeedsReview = allEstimates.filter(
    e => e.estimate_visit_completed && e.status !== "accepted" && e.status !== "declined"
  );

  const baseFilteredEstimates = allEstimates.filter(e => {
    const customerName = e.customer?.name || "";
    const jobName = e.job?.name || "";
    return (
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      jobName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredEstimates = showOnlyNeedsReview
    ? baseFilteredEstimates.filter(e =>
        e.estimate_visit_completed && e.status !== "accepted" && e.status !== "declined"
      )
    : baseFilteredEstimates;

  const filteredInvoices = allInvoices.filter(i => {
    const customerName = i.customer?.name || "";
    const jobName = i.job?.name || "";
    const matchesSearch =
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      jobName.toLowerCase().includes(searchQuery.toLowerCase());

    if (agingFilter === "all") return matchesSearch;
    if (agingFilter === "0-7") return matchesSearch && i.status !== "overdue";
    if (agingFilter === "8-30") return matchesSearch && i.status === "partial";
    if (agingFilter === "31+") return matchesSearch && i.status === "overdue";
    return matchesSearch;
  });

  const filteredPayments = allPayments.filter(p => {
    const customerName = p.customer?.name || "";
    return customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const transformEstimate = (estimate: EstimateWithDetails, needsReview: boolean) => ({
    id: estimate.id,
    customerId: estimate.customer_id,
    customerName: estimate.customer?.name || "Unknown",
    jobId: estimate.job_id || undefined,
    jobName: estimate.recurring_job_id
      ? `${estimate.customer?.name || "Unknown"} Quote`
      : (estimate.job?.name || undefined),
    lineItems: estimate.line_items.map(item => ({
      id: item.id,
      name: item.name,
      qty: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unit_price),
      total: Number(item.total),
    })),
    subtotal: Number(estimate.subtotal),
    taxRate: Number(estimate.tax_rate),
    tax: Number(estimate.tax),
    discount: Number(estimate.discount),
    total: Number(estimate.total),
    status: estimate.status,
    needsReview,
    createdAt: estimate.created_at ? format(new Date(estimate.created_at), "MMM d") : "",
    sentAt: estimate.sent_at ? format(new Date(estimate.sent_at), "MMM d") : undefined,
    viewedAt: estimate.viewed_at ? format(new Date(estimate.viewed_at), "MMM d") : undefined,
    acceptedAt: estimate.accepted_at ? format(new Date(estimate.accepted_at), "MMM d") : undefined,
    expiresAt: estimate.expires_at ? format(new Date(estimate.expires_at), "MMM d") : undefined,
  });

  const handleCreateInvoice = () => {
    navigate("/payments/invoices/new");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Payments"
        subtitle={`$${totalCollected.toLocaleString()} collected this month`}
      />

      {allNeedsReview.length > 0 && (
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (activeTab !== "estimates") {
                  setActiveTab("estimates");
                }
                setShowOnlyNeedsReview(!showOnlyNeedsReview);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))] text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <ClipboardCheck className="h-4 w-4" />
              {allNeedsReview.length} Needs Review
            </button>
          </div>
        </div>
      )}

  <div className="max-w-[var(--content-max-width)] m-auto p-4 pb-0">
<div className="rounded-lg bg-card border border-border">

      <div className="px-4 overflow-x-auto scrollbar-hide border-b border-borde ">
        <div className="flex">
          {[
            { id: "estimates" as const, label: "Estimates", icon: FileText },
            { id: "invoices" as const, label: "Invoices", icon: DollarSign },
            { id: "charge" as const, label: "Payments", icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== "estimates") {
                  setShowOnlyNeedsReview(false);
                }
              }}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap flex items-center gap-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 ">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {activeTab === "invoices" && (
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {[
              { value: "all" as const, label: "All" },
              { value: "0-7" as const, label: "0-7 days" },
              { value: "8-30" as const, label: "8-30 days" },
              { value: "31+" as const, label: "31+ days" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setAgingFilter(option.value)}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-touch",
                  agingFilter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
</div>
</div>

      <main className="p-4 max-w-[var(--content-max-width)] m-auto">
        {activeTab === "estimates" && (
          <div className="space-y-3">
            {filteredEstimates.map((estimate) => {
              const isNeedsReview = estimate.estimate_visit_completed && estimate.status !== "accepted" && estimate.status !== "declined";
              return (
                <EstimateCard
                  key={estimate.id}
                  estimate={transformEstimate(estimate, !!isNeedsReview)}
                  onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                />
              );
            })}
            {filteredEstimates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {showOnlyNeedsReview ? "No estimates need review" : "No estimates found"}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => {
              const transformedInvoice = {
                id: invoice.id,
                customerId: invoice.customer_id,
                customerName: invoice.customer?.name || "Unknown",
                jobId: invoice.job_id || undefined,
                jobName: invoice.job?.name || undefined,
                lineItems: invoice.line_items.map(item => ({
                  id: item.id,
                  name: item.name,
                  qty: Number(item.quantity),
                  unit: item.unit,
                  unitPrice: Number(item.unit_price),
                  total: Number(item.total),
                })),
                subtotal: Number(invoice.subtotal),
                taxRate: Number(invoice.tax_rate),
                tax: Number(invoice.tax),
                discount: Number(invoice.discount),
                total: Number(invoice.total),
                balanceDue: Number(invoice.balance_due),
                status: invoice.status,
                dueDate: invoice.due_date ? format(new Date(invoice.due_date), "MMM d") : "",
                createdAt: invoice.created_at ? format(new Date(invoice.created_at), "MMM d") : "",
                sentAt: invoice.sent_at ? format(new Date(invoice.sent_at), "MMM d") : undefined,
                paidAt: invoice.paid_at ? format(new Date(invoice.paid_at), "MMM d") : undefined,
              };
              return (
                <InvoiceCard
                  key={invoice.id}
                  invoice={transformedInvoice}
                  onClick={() => navigate(`/payments/invoices/${invoice.id}`)}
                />
              );
            })}
            {filteredInvoices.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No invoices found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "charge" && (
          <div className="space-y-3">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground mb-2">Recent Payments</h3>
            </div>
            {filteredPayments.map((payment) => {
              const transformedPayment = {
                id: payment.id,
                invoiceId: payment.invoice_id,
                customerId: payment.customer_id,
                customerName: payment.customer?.name || "Unknown",
                jobId: payment.job_id || undefined,
                amount: Number(payment.amount),
                method: payment.method,
                status: payment.status,
                transactionRef: payment.transaction_ref || undefined,
                createdAt: payment.created_at ? format(new Date(payment.created_at), "MMM d") : "",
                receiptUrl: payment.receipt_url || undefined,
              };
              return (
                <PaymentCard
                  key={payment.id}
                  payment={transformedPayment}
                  onClick={() => navigate(`/payments/${payment.id}`)}
                />
              );
            })}
            {filteredPayments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No payments found</p>
              </div>
            )}
          </div>
        )}
      </main>



      <FloatingActionButton
        actions={
          activeTab === "invoices"
            ? [
                {
                  icon: <DollarSign className="h-5 w-5" />,
                  label: "New Invoice",
                  onClick: handleCreateInvoice,
                  primary: true,
                },
              ]
            : activeTab === "charge"
            ? [
                {
                  icon: <CreditCard className="h-5 w-5" />,
                  label: "Charge Now",
                  onClick: () => navigate("/payments/charge"),
                  primary: true,
                },
              ]
            : []
        }
      />
    </AppLayout>
  );
}
