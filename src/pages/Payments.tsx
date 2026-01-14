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
import { Estimate, Invoice, Payment } from "@/types/payments";

// Demo data
const demoEstimates: Estimate[] = [
  {
    id: "est-1",
    customerId: "cust-1",
    customerName: "Johnson Residence",
    jobId: "job-1",
    jobName: "Patio Installation",
    lineItems: [
      { id: "li-1", name: "Cambridge Cobble Pavers", qty: 400, unit: "sq ft", unitPrice: 12, total: 4800 },
      { id: "li-2", name: "Base Preparation", qty: 1, unit: "job", unitPrice: 1500, total: 1500 },
      { id: "li-3", name: "Labor", qty: 24, unit: "hours", unitPrice: 85, total: 2040 },
    ],
    subtotal: 8340,
    taxRate: 0.08,
    tax: 667.20,
    discount: 0,
    total: 9007.20,
    status: "sent",
    createdAt: "Jan 10",
    sentAt: "Jan 10",
    expiresAt: "Jan 24",
  },
  {
    id: "est-2",
    customerId: "cust-2",
    customerName: "Williams Family",
    jobId: "job-2",
    jobName: "Pool Deck",
    lineItems: [
      { id: "li-1", name: "Travertine Pavers", qty: 600, unit: "sq ft", unitPrice: 18, total: 10800 },
      { id: "li-2", name: "Drainage System", qty: 1, unit: "job", unitPrice: 2500, total: 2500 },
    ],
    subtotal: 13300,
    taxRate: 0.08,
    tax: 1064,
    discount: 500,
    total: 13864,
    status: "viewed",
    createdAt: "Jan 8",
    sentAt: "Jan 8",
    viewedAt: "Jan 9",
    expiresAt: "Jan 22",
  },
  {
    id: "est-3",
    customerId: "cust-3",
    customerName: "Garcia Home",
    jobId: "job-3",
    jobName: "Fire Pit Area",
    lineItems: [
      { id: "li-1", name: "Fire Pit Kit", qty: 1, unit: "kit", unitPrice: 2500, total: 2500 },
      { id: "li-2", name: "Seating Area Pavers", qty: 200, unit: "sq ft", unitPrice: 14, total: 2800 },
    ],
    subtotal: 5300,
    taxRate: 0.08,
    tax: 424,
    discount: 0,
    total: 5724,
    status: "accepted",
    createdAt: "Jan 5",
    sentAt: "Jan 5",
    viewedAt: "Jan 5",
    acceptedAt: "Jan 6",
  },
];

const demoInvoices: Invoice[] = [
  {
    id: "inv-1",
    customerId: "cust-4",
    customerName: "Martinez Backyard",
    jobId: "job-4",
    jobName: "Walkway Installation",
    lineItems: [
      { id: "li-1", name: "Bluestone Pavers", qty: 150, unit: "sq ft", unitPrice: 20, total: 3000 },
      { id: "li-2", name: "Installation Labor", qty: 16, unit: "hours", unitPrice: 75, total: 1200 },
    ],
    subtotal: 4200,
    taxRate: 0.08,
    tax: 336,
    discount: 0,
    total: 4536,
    balanceDue: 4536,
    status: "sent",
    dueDate: "Jan 20",
    createdAt: "Jan 6",
    sentAt: "Jan 6",
  },
  {
    id: "inv-2",
    customerId: "cust-5",
    customerName: "Thompson Estate",
    jobId: "job-5",
    jobName: "Full Landscape",
    lineItems: [
      { id: "li-1", name: "Design & Planning", qty: 1, unit: "job", unitPrice: 5000, total: 5000 },
      { id: "li-2", name: "Materials", qty: 1, unit: "lot", unitPrice: 15000, total: 15000 },
      { id: "li-3", name: "Labor", qty: 120, unit: "hours", unitPrice: 85, total: 10200 },
    ],
    subtotal: 30200,
    taxRate: 0.08,
    tax: 2416,
    discount: 1000,
    total: 31616,
    balanceDue: 0,
    status: "paid",
    dueDate: "Jan 5",
    createdAt: "Dec 20",
    sentAt: "Dec 20",
    paidAt: "Jan 3",
  },
  {
    id: "inv-3",
    customerId: "cust-6",
    customerName: "Chen Residence",
    jobId: "job-6",
    jobName: "Retaining Wall",
    lineItems: [
      { id: "li-1", name: "Wall Blocks", qty: 200, unit: "blocks", unitPrice: 12, total: 2400 },
      { id: "li-2", name: "Labor", qty: 32, unit: "hours", unitPrice: 85, total: 2720 },
    ],
    subtotal: 5120,
    taxRate: 0.08,
    tax: 409.60,
    discount: 0,
    total: 5529.60,
    balanceDue: 2764.80,
    status: "partial",
    dueDate: "Jan 15",
    createdAt: "Jan 2",
    sentAt: "Jan 2",
  },
  {
    id: "inv-4",
    customerId: "cust-7",
    customerName: "Wilson Property",
    jobId: "job-7",
    jobName: "Driveway Extension",
    lineItems: [
      { id: "li-1", name: "Concrete Work", qty: 1, unit: "job", unitPrice: 8500, total: 8500 },
    ],
    subtotal: 8500,
    taxRate: 0.08,
    tax: 680,
    discount: 0,
    total: 9180,
    balanceDue: 9180,
    status: "overdue",
    dueDate: "Jan 1",
    createdAt: "Dec 15",
    sentAt: "Dec 15",
  },
];

const demoPayments: Payment[] = [
  {
    id: "pay-1",
    invoiceId: "inv-2",
    customerId: "cust-5",
    customerName: "Thompson Estate",
    jobId: "job-5",
    amount: 31616,
    method: "ach",
    status: "completed",
    transactionRef: "ACH-2024-0103-001",
    createdAt: "Jan 3",
    receiptUrl: "#",
  },
  {
    id: "pay-2",
    invoiceId: "inv-3",
    customerId: "cust-6",
    customerName: "Chen Residence",
    jobId: "job-6",
    amount: 2764.80,
    method: "card",
    status: "completed",
    transactionRef: "CC-2024-0108-002",
    createdAt: "Jan 8",
    receiptUrl: "#",
  },
  {
    id: "pay-3",
    invoiceId: "inv-5",
    customerId: "cust-8",
    customerName: "Adams Home",
    jobId: "job-8",
    amount: 1500,
    method: "cash",
    status: "completed",
    createdAt: "Jan 10",
  },
  {
    id: "pay-4",
    invoiceId: "inv-6",
    customerId: "cust-9",
    customerName: "Baker Landscaping",
    amount: 3200,
    method: "tap-to-pay",
    status: "completed",
    transactionRef: "TAP-2024-0112-001",
    createdAt: "Jan 12",
    receiptUrl: "#",
  },
];

type ActiveTab = "estimates" | "invoices" | "charge";
type AgingFilter = "all" | "0-7" | "8-30" | "31+";

export default function Payments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>("estimates");
  const [searchQuery, setSearchQuery] = useState("");
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");

  // Stats
  const totalCollected = demoPayments.filter(p => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
  const pendingInvoices = demoInvoices.filter(i => i.balanceDue > 0).reduce((sum, i) => sum + i.balanceDue, 0);
  const pendingEstimates = demoEstimates.filter(e => e.status === "sent" || e.status === "viewed").reduce((sum, e) => sum + e.total, 0);

  // Filter logic
  const filteredEstimates = demoEstimates.filter(e =>
    e.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.jobName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = demoInvoices.filter(i => {
    const matchesSearch = i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.jobName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (agingFilter === "all") return matchesSearch;
    // Simple aging filter simulation
    if (agingFilter === "0-7") return matchesSearch && i.status !== "overdue";
    if (agingFilter === "8-30") return matchesSearch && i.status === "partial";
    if (agingFilter === "31+") return matchesSearch && i.status === "overdue";
    return matchesSearch;
  });

  const filteredPayments = demoPayments.filter(p =>
    p.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            {filteredEstimates.map((estimate) => (
              <EstimateCard
                key={estimate.id}
                estimate={estimate}
                onClick={() => navigate(`/payments/estimates/${estimate.id}`)}
              />
            ))}
            {filteredEstimates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No estimates found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onClick={() => navigate(`/payments/invoices/${invoice.id}`)}
              />
            ))}
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
            {filteredPayments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onClick={() => navigate(`/payments/${payment.id}`)}
              />
            ))}
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
