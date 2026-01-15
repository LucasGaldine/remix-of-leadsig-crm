import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Download, DollarSign, FileText, CreditCard, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstimateCard } from "@/components/payments/EstimateCard";
import { InvoiceCard } from "@/components/payments/InvoiceCard";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { cn } from "@/lib/utils";
import { useEstimates } from "@/hooks/useEstimates";
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

  const { data: allEstimates = [], isLoading: estimatesLoading } = useEstimates({ limit: 100 });
  const { data: allInvoices = [], isLoading: invoicesLoading } = useInvoices({ limit: 100 });
  const { data: allPayments = [], isLoading: paymentsLoading } = usePayments({ limit: 100 });

  const isLoading = estimatesLoading || invoicesLoading || paymentsLoading;

  const totalCollected = allPayments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingInvoices = allInvoices
    .filter(i => Number(i.balance_due || 0) > 0)
    .reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

  const pendingEstimates = allEstimates
    .filter(e => e.status === "sent" || e.status === "viewed")
    .reduce((sum, e) => sum + Number(e.total || 0), 0);

  const filteredEstimates = allEstimates.filter(e => {
    const customerName = e.customer?.name || "";
    const jobName = e.job?.name || "";
    return (
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      jobName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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

  const handleExport = () => {
    toast.info("Export coming soon", {
      description: "This feature is under development.",
    });
  };

  const handleCreateEstimate = () => {
    navigate("/payments/estimates/new");
  };

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
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Payments"
        subtitle={`$${totalCollected.toLocaleString()} collected this month`}
      />

      {/* Summary Cards */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-confirmed-bg))] border border-[hsl(var(--status-confirmed))]/20 min-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-[hsl(var(--status-confirmed))]" />
              <span className="text-2xs text-[hsl(var(--status-confirmed))]">Collected</span>
            </div>
            <p className="text-lg font-bold text-foreground">${totalCollected.toLocaleString()}</p>
          </div>
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-pending-bg))] border border-[hsl(var(--status-pending))]/20 min-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-[hsl(var(--status-pending))]" />
              <span className="text-2xs text-[hsl(var(--status-pending))]">Pending</span>
            </div>
            <p className="text-lg font-bold text-foreground">${pendingInvoices.toLocaleString()}</p>
          </div>
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-paid-bg))] border border-[hsl(var(--status-paid))]/20 min-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-[hsl(var(--status-paid))]" />
              <span className="text-2xs text-[hsl(var(--status-paid))]">Estimates</span>
            </div>
            <p className="text-lg font-bold text-foreground">${pendingEstimates.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {[
            { id: "estimates" as const, label: "Estimates", icon: FileText },
            { id: "invoices" as const, label: "Invoices", icon: DollarSign },
            { id: "charge" as const, label: "Charge", icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* Search & Actions */}
      <div className="px-4 py-3 bg-card border-b border-border space-y-3">
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
        <div className="flex gap-2">
          {activeTab === "estimates" && (
            <Button className="flex-1 gap-2" onClick={handleCreateEstimate}>
              <Plus className="h-4 w-4" />
              Create Estimate
            </Button>
          )}
          {activeTab === "invoices" && (
            <>
              <Button className="flex-1 gap-2" onClick={handleCreateInvoice}>
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
              <Button variant="outline" size="icon" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
          {activeTab === "charge" && (
            <>
              <Button className="flex-1 gap-2" onClick={() => navigate("/payments/charge")}>
                <CreditCard className="h-4 w-4" />
                Charge Now
              </Button>
              <Button variant="outline" size="icon" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Aging Filter for Invoices */}
      {activeTab === "invoices" && (
        <div className="px-4 py-3 bg-card border-b border-border overflow-x-auto scrollbar-hide">
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

      {/* Content */}
      <main className="px-4 py-4">
        {activeTab === "estimates" && (
          <div className="space-y-3">
            {filteredEstimates.map((estimate) => {
              const transformedEstimate = {
                id: estimate.id,
                customerId: estimate.customer_id,
                customerName: estimate.customer?.name || "Unknown",
                jobId: estimate.job_id || undefined,
                jobName: estimate.job?.name || undefined,
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
                createdAt: estimate.created_at ? format(new Date(estimate.created_at), "MMM d") : "",
                sentAt: estimate.sent_at ? format(new Date(estimate.sent_at), "MMM d") : undefined,
                viewedAt: estimate.viewed_at ? format(new Date(estimate.viewed_at), "MMM d") : undefined,
                acceptedAt: estimate.accepted_at ? format(new Date(estimate.accepted_at), "MMM d") : undefined,
                expiresAt: estimate.expires_at ? format(new Date(estimate.expires_at), "MMM d") : undefined,
              };
              return (
                <EstimateCard
                  key={estimate.id}
                  estimate={transformedEstimate}
                  onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                />
              );
            })}
            {filteredEstimates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No estimates found</p>
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
          activeTab === "estimates"
            ? [
                {
                  icon: <FileText className="h-5 w-5" />,
                  label: "New Estimate",
                  onClick: handleCreateEstimate,
                  primary: true,
                },
              ]
            : activeTab === "invoices"
            ? [
                {
                  icon: <DollarSign className="h-5 w-5" />,
                  label: "New Invoice",
                  onClick: handleCreateInvoice,
                  primary: true,
                },
              ]
            : [
                {
                  icon: <CreditCard className="h-5 w-5" />,
                  label: "Charge Now",
                  onClick: () => navigate("/payments/charge"),
                  primary: true,
                },
              ]
        }
      />

      <MobileNav />
    </div>
  );
}
