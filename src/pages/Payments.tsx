import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Check, Search, DollarSign, FileText, CreditCard, ClipboardCheck, Download, Inbox as InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EstimateCard } from "@/components/payments/EstimateCard";
import { InvoiceCard } from "@/components/payments/InvoiceCard";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { ExportInvoicesModal } from "@/components/payments/ExportInvoicesModal";
import { cn } from "@/lib/utils";
import { useEstimates, EstimateWithDetails } from "@/hooks/useEstimates";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { format } from "date-fns";
import {
  sortEstimateItems,
  sortInvoiceItems,
  sortPaymentItems,
  type EstimateSortOption,
  type InvoiceSortOption,
  type PaymentSortOption,
} from "@/lib/pageSorting";

type ActiveTab = "all" | "estimates" | "invoices" | "payments";
type AgingFilter = "all" | "0-7" | "8-30" | "31+";
type AllActivitySortOption = "newest" | "oldest" | "amount_desc" | "amount_asc" | "customer_asc" | "customer_desc";

export default function Payments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [estimateSortBy, setEstimateSortBy] = useState<EstimateSortOption>("newest");
  const [invoiceSortBy, setInvoiceSortBy] = useState<InvoiceSortOption>("newest");
  const [paymentSortBy, setPaymentSortBy] = useState<PaymentSortOption>("newest");
  const [allSortBy, setAllSortBy] = useState<AllActivitySortOption>("newest");

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

  const allToEstimateSort = (sortBy: AllActivitySortOption): EstimateSortOption => {
    if (sortBy === "amount_desc") return "total_desc";
    if (sortBy === "amount_asc") return "total_asc";
    return sortBy;
  };

  const effectiveEstimateSortBy = activeTab === "estimates" ? estimateSortBy : allToEstimateSort(allSortBy);
  const effectiveInvoiceSortBy = activeTab === "invoices" ? invoiceSortBy : allSortBy;
  const effectivePaymentSortBy = activeTab === "payments" ? paymentSortBy : allSortBy;

  const filteredEstimates = useMemo(() => {
    const baseFilteredEstimates = allEstimates.filter((estimate) => {
      const customerName = estimate.customer?.name || "";
      const jobName = estimate.job?.name || "";
      return (
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jobName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    const estimatesByReview = showOnlyNeedsReview
      ? baseFilteredEstimates.filter(
          (estimate) => estimate.estimate_visit_completed && estimate.status !== "accepted" && estimate.status !== "declined",
        )
      : baseFilteredEstimates;

    return sortEstimateItems(estimatesByReview, effectiveEstimateSortBy);
  }, [allEstimates, searchQuery, showOnlyNeedsReview, effectiveEstimateSortBy]);

  const filteredInvoices = useMemo(() => {
    const matchingInvoices = allInvoices.filter((invoice) => {
      const customerName = invoice.customer?.name || "";
      const jobName = invoice.job?.name || "";
      const matchesSearch =
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jobName.toLowerCase().includes(searchQuery.toLowerCase());

      if (agingFilter === "all") return matchesSearch;
      if (agingFilter === "0-7") return matchesSearch && invoice.status !== "overdue";
      if (agingFilter === "8-30") return matchesSearch && invoice.status === "partial";
      if (agingFilter === "31+") return matchesSearch && invoice.status === "overdue";
      return matchesSearch;
    });

    return sortInvoiceItems(matchingInvoices, effectiveInvoiceSortBy);
  }, [allInvoices, searchQuery, agingFilter, effectiveInvoiceSortBy]);

  const filteredPayments = useMemo(() => {
    const matchingPayments = allPayments.filter((payment) => {
      const customerName = payment.customer?.name || "";
      return customerName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return sortPaymentItems(matchingPayments, effectivePaymentSortBy);
  }, [allPayments, searchQuery, effectivePaymentSortBy]);

  const chipConfig: Array<{ id: ActiveTab; label: string; icon: typeof InboxIcon }> = [
    { id: "all", label: "All", icon: InboxIcon },
    { id: "estimates", label: "Estimates", icon: FileText },
    { id: "invoices", label: "Invoices", icon: DollarSign },
    { id: "payments", label: "Payments", icon: CreditCard },
  ];

  const filterCount = (filter: ActiveTab) => {
    if (filter === "all") return filteredEstimates.length + filteredInvoices.length + filteredPayments.length;
    if (filter === "estimates") return filteredEstimates.length;
    if (filter === "invoices") return filteredInvoices.length;
    return filteredPayments.length;
  };

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
  const estimateSortOptions: Array<{ value: EstimateSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "total_desc", label: "Amount high-low" },
    { value: "total_asc", label: "Amount low-high" },
    { value: "customer_asc", label: "Customer A-Z" },
    { value: "customer_desc", label: "Customer Z-A" },
  ];
  const invoiceSortOptions: Array<{ value: InvoiceSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "amount_desc", label: "Amount high-low" },
    { value: "amount_asc", label: "Amount low-high" },
    { value: "customer_asc", label: "Customer A-Z" },
    { value: "customer_desc", label: "Customer Z-A" },
  ];
  const paymentSortOptions: Array<{ value: PaymentSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "amount_desc", label: "Amount high-low" },
    { value: "amount_asc", label: "Amount low-high" },
    { value: "customer_asc", label: "Customer A-Z" },
    { value: "customer_desc", label: "Customer Z-A" },
  ];
  const allSortOptions: Array<{ value: AllActivitySortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "amount_desc", label: "Amount high-low" },
    { value: "amount_asc", label: "Amount low-high" },
    { value: "customer_asc", label: "Customer A-Z" },
    { value: "customer_desc", label: "Customer Z-A" },
  ];

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
        hideTitle
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

      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={activeTab === "all" ? "Search payments..." : `Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={`Sort ${activeTab === "all" ? "all" : activeTab}`}>
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {activeTab === "estimates"
                    ? estimateSortOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onSelect={() => setEstimateSortBy(option.value)}>
                          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                            {estimateSortBy === option.value ? <Check className="h-4 w-4" /> : null}
                          </span>
                          {option.label}
                        </DropdownMenuItem>
                      ))
                    : null}
                  {activeTab === "invoices"
                    ? invoiceSortOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onSelect={() => setInvoiceSortBy(option.value)}>
                          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                            {invoiceSortBy === option.value ? <Check className="h-4 w-4" /> : null}
                          </span>
                          {option.label}
                        </DropdownMenuItem>
                      ))
                    : null}
                  {activeTab === "payments"
                    ? paymentSortOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onSelect={() => setPaymentSortBy(option.value)}>
                          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                            {paymentSortBy === option.value ? <Check className="h-4 w-4" /> : null}
                          </span>
                          {option.label}
                        </DropdownMenuItem>
                      ))
                    : null}
                  {activeTab === "all"
                    ? allSortOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onSelect={() => setAllSortBy(option.value)}>
                          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                            {allSortBy === option.value ? <Check className="h-4 w-4" /> : null}
                          </span>
                          {option.label}
                        </DropdownMenuItem>
                      ))
                    : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pt-2 pb-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              {chipConfig.map((chip) => {
                const Icon = chip.icon;
                const isActive = activeTab === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => {
                      setActiveTab(chip.id);
                      if (chip.id !== "estimates") {
                        setShowOnlyNeedsReview(false);
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{chip.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs",
                        isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {filterCount(chip.id)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "invoices" && (
            <div className="px-4 pt-2 pb-3 overflow-x-auto scrollbar-hide">
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
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 pt-5 pb-3 border-t border-border">
            <div className="inline-flex items-center gap-2">
              {activeTab === "all" ? <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              {activeTab === "estimates" ? <FileText className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              {activeTab === "invoices" ? <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              {activeTab === "payments" ? <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {activeTab === "all" ? "All" : activeTab === "estimates" ? "Estimates" : activeTab === "invoices" ? "Invoices" : "Payments"}
              </p>
            </div>
          </div>

          {(activeTab === "all" || activeTab === "estimates") && (
            filteredEstimates.length === 0 ? (
              activeTab === "estimates" ? (
                <div className="px-4 pb-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {showOnlyNeedsReview ? "No estimates need review." : "No estimates found."}
                  </div>
                </div>
              ) : null
            ) : (
              <div>
                {filteredEstimates.map((estimate, index) => {
                  const isNeedsReview = estimate.estimate_visit_completed && estimate.status !== "accepted" && estimate.status !== "declined";
                  return (
                    <EstimateCard
                      key={estimate.id}
                      estimate={transformEstimate(estimate, !!isNeedsReview)}
                      onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
                      className={cn(
                        "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-accent/40",
                        index > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border",
                      )}
                    />
                  );
                })}
              </div>
            )
          )}

          {(activeTab === "all" || activeTab === "invoices") && (
            filteredInvoices.length === 0 ? (
              activeTab === "invoices" ? (
                <div className="px-4 pb-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </div>
                </div>
              ) : null
            ) : (
              <div className={cn(activeTab === "all" && filteredEstimates.length > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border")}>
                {activeTab === "all" ? (
                  <div className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Invoices</div>
                ) : null}
                {filteredInvoices.map((invoice, index) => {
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
                      className={cn(
                        "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-accent/40",
                        index > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border",
                      )}
                    />
                  );
                })}
              </div>
            )
          )}

          {(activeTab === "all" || activeTab === "payments") && (
            filteredPayments.length === 0 ? (
              activeTab === "payments" ? (
                <div className="px-4 pb-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No payments found.
                  </div>
                </div>
              ) : null
            ) : (
              <div className={cn(activeTab === "all" && (filteredEstimates.length > 0 || filteredInvoices.length > 0) && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border")}>
                {activeTab === "all" ? (
                  <div className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Payments</div>
                ) : null}
                {filteredPayments.map((payment, index) => {
                  const transformedPayment = {
                    id: payment.id,
                    invoiceId: payment.invoice_id,
                    customerId: payment.customer_id,
                    customerName: payment.customer?.name || "Unknown",
                    jobId: payment.job_id || undefined,
                    amount: Number(payment.amount),
                    method: payment.method,
                    status: payment.status,
                    paymentChannel: payment.payment_channel || undefined,
                    terminalStatus: payment.stripe_terminal_payment_intent_status || undefined,
                    stripeTerminalReaderId: payment.stripe_terminal_reader_id || undefined,
                    stripeTerminalLocationId: payment.stripe_terminal_location_id || undefined,
                    stripeTerminalPaymentIntentId: payment.stripe_payment_intent_id || undefined,
                    transactionRef: payment.transaction_ref || undefined,
                    createdAt: payment.created_at ? format(new Date(payment.created_at), "MMM d") : "",
                    receiptUrl: payment.receipt_url || undefined,
                  };
                  return (
                    <PaymentCard
                      key={payment.id}
                      payment={transformedPayment}
                      onClick={() => {
                        navigate(`/payments/${payment.id}`);
                      }}
                      className={cn(
                        "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-accent/40",
                        index > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border",
                      )}
                    />
                  );
                })}
              </div>
            )
          )}

          {activeTab === "all" && filterCount("all") === 0 ? (
            <div className="px-4 pb-6">
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No matching activity found.
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <FloatingActionButton
        actions={[
          {
            icon: <Download className="h-5 w-5" />,
            label: "Export Data",
            onClick: () => setExportModalOpen(true),
            primary: true,
          },
        ]}
      />

      <MobileNav />

      <ExportInvoicesModal open={exportModalOpen} onOpenChange={setExportModalOpen} />
    </div>
  );
}
