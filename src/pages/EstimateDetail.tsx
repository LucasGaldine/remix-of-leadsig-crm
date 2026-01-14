import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Send,
  FileText,
  ArrowRightLeft,
  Copy,
  Trash2,
  User,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Estimate, EstimateStatus } from "@/types/payments";

// Demo estimate data
const estimateData: Estimate = {
  id: "est-1",
  customerId: "cust-1",
  customerName: "Johnson Residence",
  jobId: "job-1",
  jobName: "Patio Installation",
  lineItems: [
    { id: "li-1", name: "Cambridge Cobble Pavers", description: "Chestnut/Brown blend, 400 sq ft coverage", qty: 400, unit: "sq ft", unitPrice: 12, total: 4800 },
    { id: "li-2", name: "Base Preparation", description: "Excavation, grading, and compacted base", qty: 1, unit: "job", unitPrice: 1500, total: 1500 },
    { id: "li-3", name: "Installation Labor", description: "Professional installation crew", qty: 24, unit: "hours", unitPrice: 85, total: 2040 },
    { id: "li-4", name: "Polymeric Sand", description: "Joint sand with hardener", qty: 10, unit: "bags", unitPrice: 35, total: 350 },
    { id: "li-5", name: "Edge Restraint", description: "Aluminum paver edge", qty: 80, unit: "ft", unitPrice: 3.50, total: 280 },
  ],
  subtotal: 8970,
  taxRate: 0.08,
  tax: 717.60,
  discount: 0,
  total: 9687.60,
  notes: "Work to be completed within 3-5 business days. Customer to ensure area is accessible and clear of obstacles.",
  status: "sent",
  createdAt: "Jan 10, 2025",
  sentAt: "Jan 10, 2025",
  expiresAt: "Jan 24, 2025",
};

const statusConfig: Record<EstimateStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", className: "status-pending" },
  viewed: { label: "Viewed", className: "status-paid" },
  accepted: { label: "Accepted", className: "status-confirmed" },
  expired: { label: "Expired", className: "status-attention" },
};

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [estimate] = useState(estimateData);

  const config = statusConfig[estimate.status];

  const handleSend = () => {
    if (import.meta.env.DEV) {
      console.log("Sending estimate via email/SMS...");
    }
  };

  const handleConvertToInvoice = () => {
    navigate("/payments/invoices/new", { state: { fromEstimate: estimate } });
  };

  const handleDuplicate = () => {
    navigate("/payments/estimates/new", { state: { duplicate: estimate } });
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Estimate" showBack backTo="/payments" showNotifications={false} />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className={cn("text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.label}
            </span>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {estimate.customerName}
            </h2>
            <p className="text-muted-foreground">{estimate.jobName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${estimate.total.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Expires {estimate.expiresAt}
            </p>
          </div>
        </div>
      </div>

      {/* Customer & Job Info */}
      <div className="px-4 py-4 space-y-3">
        <button className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Customer</p>
              <p className="text-sm text-muted-foreground">{estimate.customerName}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>

        <button className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Calendar className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Created</p>
              <p className="text-sm text-muted-foreground">{estimate.createdAt}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Line Items */}
      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Line Items</h3>
        <div className="card-elevated rounded-lg overflow-hidden">
          {estimate.lineItems.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "p-4",
                index < estimate.lineItems.length - 1 && "border-b border-border"
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
            <span className="text-foreground">${estimate.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({(estimate.taxRate * 100).toFixed(0)}%)</span>
            <span className="text-foreground">${estimate.tax.toLocaleString()}</span>
          </div>
          {estimate.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-[hsl(var(--status-confirmed))]">-${estimate.discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-lg text-foreground">${estimate.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {estimate.notes && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{estimate.notes}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <div className="flex gap-2">
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
          <Button className="flex-1 h-14 gap-2" onClick={handleConvertToInvoice}>
            <ArrowRightLeft className="h-4 w-4" />
            Convert to Invoice
          </Button>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
