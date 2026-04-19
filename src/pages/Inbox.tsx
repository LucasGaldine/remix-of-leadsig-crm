import { useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Search,
  Inbox as InboxIcon,
  User,
  Magnet,
  Briefcase,
  FileText,
  Receipt,
  CreditCard,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { useAuth } from "@/hooks/useAuth";
import { useLeads } from "@/hooks/useLeads";
import { useCustomers } from "@/hooks/useCustomers";
import { useJobs } from "@/hooks/useJobs";
import { useEstimates } from "@/hooks/useEstimates";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { cn } from "@/lib/utils";

type InboxType = "client" | "lead" | "job" | "estimate" | "invoice" | "payment";
type InboxFilter = "all" | InboxType;
type Tone = "neutral" | "confirmed" | "pending" | "attention";
type InboxSortOption = "newest" | "oldest" | "name_asc" | "name_desc" | "type";

interface InboxItem {
  id: string;
  type: InboxType;
  title: string;
  subtitle: string;
  status: string;
  tone: Tone;
  timestamp: number;
  path: string;
  searchableText: string;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const chipConfig: Array<{ value: InboxFilter; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: InboxIcon },
  { value: "client", label: "Clients", icon: User },
  { value: "lead", label: "Leads", icon: Magnet },
  { value: "job", label: "Jobs", icon: Briefcase },
  { value: "estimate", label: "Estimates", icon: FileText },
  { value: "invoice", label: "Invoices", icon: Receipt },
  { value: "payment", label: "Payments", icon: CreditCard },
];

const rowIconConfig: Record<InboxType, { icon: ComponentType<{ className?: string }>; className: string }> = {
  client: { icon: User, className: "text-sky-600" },
  lead: { icon: Magnet, className: "text-sky-600" },
  job: { icon: Briefcase, className: "text-emerald-600" },
  estimate: { icon: FileText, className: "text-amber-600" },
  invoice: { icon: Receipt, className: "text-indigo-600" },
  payment: { icon: CreditCard, className: "text-violet-600" },
};

const toneClass: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  confirmed: "text-[hsl(var(--status-confirmed))]",
  pending: "text-[hsl(var(--status-pending))]",
  attention: "text-[hsl(var(--status-attention))]",
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return format(parsed, "MMM d");
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function estimateStatus(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "accepted":
      return { label: "Approved", tone: "confirmed" };
    case "declined":
      return { label: "Declined", tone: "attention" };
    case "expired":
      return { label: "Expired", tone: "attention" };
    case "sent":
    case "viewed":
      return { label: "Awaiting Approval", tone: "pending" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

function invoiceStatus(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "paid":
      return { label: "Paid", tone: "confirmed" };
    case "overdue":
      return { label: "Late", tone: "attention" };
    case "partial":
      return { label: "Partial", tone: "pending" };
    case "sent":
    case "viewed":
      return { label: "Awaiting Payment", tone: "pending" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

function paymentStatus(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "completed":
      return { label: "Completed", tone: "confirmed" };
    case "pending":
      return { label: "Pending", tone: "pending" };
    case "failed":
      return { label: "Failed", tone: "attention" };
    case "refunded":
      return { label: "Refunded", tone: "neutral" };
    default:
      return { label: "Recorded", tone: "neutral" };
  }
}

function jobStatus(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "completed":
      return { label: "Completed", tone: "confirmed" };
    case "in_progress":
      return { label: "In Progress", tone: "pending" };
    case "scheduled":
      return { label: "Scheduled", tone: "pending" };
    case "unscheduled":
      return { label: "Unscheduled", tone: "neutral" };
    case "cancelled":
      return { label: "Cancelled", tone: "attention" };
    default:
      return { label: "Active", tone: "neutral" };
  }
}

function leadStatus(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "qualified":
      return { label: "Qualified", tone: "confirmed" };
    case "contacted":
      return { label: "Contacted", tone: "pending" };
    default:
      return { label: "New", tone: "neutral" };
  }
}

export default function Inbox() {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [sortBy, setSortBy] = useState<InboxSortOption>("newest");

  const { data: customers = [], isLoading: customersLoading, refetch: refetchCustomers } = useCustomers();
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useLeads();
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useJobs();
  const { data: estimates = [], isLoading: estimatesLoading } = useEstimates({ limit: 100 });
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices({ limit: 100 });
  const { data: payments = [], isLoading: paymentsLoading } = usePayments({ limit: 100 });

  const isLoading = customersLoading || leadsLoading || jobsLoading || estimatesLoading || invoicesLoading || paymentsLoading;

  const items = useMemo<InboxItem[]>(() => {
    const clientItems: InboxItem[] = (customers as any[]).map((customer) => ({
      id: customer.id,
      type: "client",
      title: customer.name || "Unnamed Client",
      subtitle: `${formatDate(customer.created_at)} | ${customer.city || customer.email || customer.phone || "No contact info"}`,
      status: "Client",
      tone: "neutral",
      timestamp: toTimestamp(customer.created_at),
      path: `/customers/${customer.id}`,
      searchableText: `${customer.name || ""} ${customer.email || ""} ${customer.phone || ""} ${customer.address || ""} ${customer.city || ""}`.toLowerCase(),
    }));

    const leadItems: InboxItem[] = (leads as any[]).map((lead) => {
      const status = leadStatus(lead.status);
      return {
        id: lead.id,
        type: "lead",
        title: lead.name || "Unnamed Lead",
        subtitle: `${formatDate(lead.created_at)} | ${lead.service_type || "No service type"}`,
        status: status.label,
        tone: status.tone,
        timestamp: toTimestamp(lead.created_at),
        path: `/leads/${lead.id}`,
        searchableText: `${lead.name || ""} ${lead.service_type || ""} ${lead.source || ""} ${lead.address || ""} ${lead.city || ""}`.toLowerCase(),
      };
    });

    const jobItems: InboxItem[] = (jobs as any[]).map((job) => {
      const displayStatus = job.display_status || job.status;
      const isUnassigned =
        Boolean(job.has_unassigned_schedule) &&
        (displayStatus === "unscheduled" || displayStatus === "scheduled" || displayStatus === "in_progress");
      const needsInvoice = job.status === "completed" && !job.has_invoice && !job.is_estimate_visit;
      const status = isUnassigned
        ? { label: "Unassigned", tone: "attention" as Tone }
        : needsInvoice
          ? { label: "Needs Invoice", tone: "attention" as Tone }
          : jobStatus(displayStatus);
      return {
        id: job.id,
        type: "job",
        title: job.customer?.name || job.name || "Unnamed Job",
        subtitle: `${formatDate(job.created_at)} | ${job.service_type || "No service type"}`,
        status: status.label,
        tone: status.tone,
        timestamp: toTimestamp(job.created_at),
        path: `/jobs/${job.id}`,
        searchableText: `${job.name || ""} ${job.customer?.name || ""} ${job.service_type || ""} ${job.address || ""} ${job.city || ""}`.toLowerCase(),
      };
    });

    const estimateItems: InboxItem[] = (estimates as any[]).map((estimate) => {
      const status = estimateStatus(estimate.status);
      return {
        id: estimate.id,
        type: "estimate",
        title: estimate.customer?.name || estimate.job?.name || "Estimate",
        subtitle: `${currency.format(Number(estimate.total || 0))} | Estimate`,
        status: status.label,
        tone: status.tone,
        timestamp: toTimestamp(estimate.created_at),
        path: `/payments/estimates/${estimate.id}`,
        searchableText: `${estimate.customer?.name || ""} ${estimate.job?.name || ""} ${estimate.status || ""}`.toLowerCase(),
      };
    });

    const invoiceItems: InboxItem[] = (invoices as any[]).map((invoice) => {
      const status = invoiceStatus(invoice.status);
      return {
        id: invoice.id,
        type: "invoice",
        title: invoice.customer?.name || invoice.job?.name || "Invoice",
        subtitle: `${formatDate(invoice.created_at)} | ${currency.format(Number(invoice.total || 0))} | Invoice #${String(invoice.id).slice(0, 6)}`,
        status: status.label,
        tone: status.tone,
        timestamp: toTimestamp(invoice.created_at),
        path: `/payments/invoices/${invoice.id}`,
        searchableText: `${invoice.customer?.name || ""} ${invoice.job?.name || ""} ${invoice.status || ""}`.toLowerCase(),
      };
    });

    const paymentItems: InboxItem[] = (payments as any[]).map((payment) => {
      const status = paymentStatus(payment.status);
      const methodLabel = String(payment.method || "payment").replace(/-/g, " ");
      return {
        id: payment.id,
        type: "payment",
        title: payment.customer?.name || "Payment",
        subtitle: `${formatDate(payment.created_at)} | ${currency.format(Number(payment.amount || 0))} | ${methodLabel}`,
        status: status.label,
        tone: status.tone,
        timestamp: toTimestamp(payment.created_at),
        path: `/payments/${payment.id}`,
        searchableText: `${payment.customer?.name || ""} ${payment.status || ""} ${methodLabel}`.toLowerCase(),
      };
    });

    return [...clientItems, ...leadItems, ...jobItems, ...estimateItems, ...invoiceItems, ...paymentItems].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [customers, leads, jobs, estimates, invoices, payments]);

  const counts = useMemo(() => {
    const base = { client: 0, lead: 0, job: 0, estimate: 0, invoice: 0, payment: 0 };
    items.forEach((item) => {
      base[item.type] += 1;
    });
    return base;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (activeFilter !== "all" && item.type !== activeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return item.title.toLowerCase().includes(query) || item.searchableText.includes(query);
    });
  }, [items, searchQuery, activeFilter]);

  const sortedItems = useMemo(() => {
    const next = [...filteredItems];

    switch (sortBy) {
      case "oldest":
        return next.sort((a, b) => a.timestamp - b.timestamp);
      case "name_asc":
        return next.sort((a, b) => a.title.localeCompare(b.title));
      case "name_desc":
        return next.sort((a, b) => b.title.localeCompare(a.title));
      case "type":
        return next.sort((a, b) => a.type.localeCompare(b.type) || b.timestamp - a.timestamp);
      case "newest":
      default:
        return next.sort((a, b) => b.timestamp - a.timestamp);
    }
  }, [filteredItems, sortBy]);

  const sortOptions: Array<{ value: InboxSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "type", label: "Type" },
  ];

  const filterCount = (filter: InboxFilter) => {
    if (filter === "all") return items.length;
    return counts[filter];
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Inbox" subtitle={`${sortedItems.length} records`} hideTitle />

      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="-mx-4 md:mx-0">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search inbox..."
                  className="h-14 rounded-full border-border bg-card px-5 pl-14 text-base text-foreground shadow-sm placeholder:text-muted-foreground"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sort inbox"
                    className="h-14 w-14 shrink-0 rounded-full border-border bg-card shadow-sm hover:bg-card"
                  >
                    <ArrowUpDown className="!h-5 !w-5 !text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {sortOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setSortBy(option.value)}>
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                        {sortBy === option.value ? <Check className="h-4 w-4" /> : null}
                      </span>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pt-2 pb-6 overflow-x-auto scrollbar-hide md:pb-3">
            <div className="flex items-center gap-2 min-w-max">
              {chipConfig.map((chip) => {
                const Icon = chip.icon;
                const isActive = activeFilter === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setActiveFilter(chip.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium transition-colors md:text-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{chip.label}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs", isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{filterCount(chip.value)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden px-4 pt-5 pb-3 md:block">
            <div className="inline-flex items-center gap-2">
              <InboxIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recent Activity</p>
            </div>
          </div>

          <div className="overflow-hidden md:rounded-2xl md:border md:border-border md:bg-card md:shadow-sm">

            {isLoading ? (
              <div className="px-4 pb-6">
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="px-4 pb-6">
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No matching activity found.
                </div>
              </div>
            ) : (
              <div>
                {sortedItems.map((item, index) => {
                  const iconData = rowIconConfig[item.type];
                  const RowIcon = iconData.icon;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "w-full border-t border-border bg-card px-4 py-8 text-left transition-colors hover:bg-accent/40 md:border-0 md:bg-transparent md:py-3",
                        index > 0 && "md:relative md:before:absolute md:before:left-4 md:before:right-4 md:before:top-0 md:before:h-px md:before:bg-border",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={cn("mt-0.5", iconData.className)}>
                            <RowIcon className="h-7 w-7 md:h-5 md:w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-1 md:text-base">{item.title}</p>
                            <p className="truncate text-sm text-muted-foreground">{item.subtitle}</p>
                          </div>
                        </div>
                        <div className={cn("inline-flex items-center gap-2 text-base font-medium text-right md:text-sm", toneClass[item.tone])}>
                          <span>{item.status}</span>
                          <span className={cn("h-2.5 w-2.5 rounded-full", item.tone === "confirmed" ? "bg-[hsl(var(--status-confirmed))]" : item.tone === "attention" ? "bg-[hsl(var(--status-attention))]" : item.tone === "pending" ? "bg-[hsl(var(--status-pending))]" : "bg-muted-foreground/50")} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <MainPageQuickActions
        show={isManager()}
        onLeadCreated={() => {
          void refetchCustomers();
          void refetchLeads();
        }}
        onJobCreated={() => {
          void refetchJobs();
        }}
      />
      <MobileNav />
    </div>
  );
}
