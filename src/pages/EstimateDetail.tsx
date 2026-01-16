import { useParams, useNavigate } from "react-router-dom";
import {
  Send,
  ArrowRightLeft,
  Copy,
  Trash2,
  User,
  Calendar,
  ChevronRight,
  AlertCircle,
  History,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEstimate } from "@/hooks/useEstimates";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", className: "status-pending" },
  viewed: { label: "Viewed", className: "status-paid" },
  accepted: { label: "Accepted", className: "status-confirmed" },
  expired: { label: "Expired", className: "status-attention" },
};

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: estimate, isLoading } = useEstimate(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Estimate" showBack backTo="/payments" showNotifications={false} />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Estimate" showBack backTo="/payments" showNotifications={false} />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Estimate not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const config = statusConfig[estimate.status as keyof typeof statusConfig];
  const hasChangeOrders = estimate.change_orders && estimate.change_orders.length > 0;

  const handleSend = () => {
    toast.info("Email/SMS sending functionality coming soon!");
  };

  const handleConvertToInvoice = () => {
    if (estimate.is_finalized) {
      toast.error("This estimate has already been converted to an invoice");
      return;
    }
    navigate("/payments/invoices/new", { state: { fromEstimate: estimate } });
  };

  const handleDuplicate = () => {
    navigate("/payments/estimates/new", { state: { duplicate: estimate } });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this estimate?")) return;
    toast.info("Delete functionality coming soon!");
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Estimate" showBack backTo="/payments" showNotifications={false} />

      {estimate.is_finalized && (
        <div className="px-4 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This estimate has been finalized and converted to an invoice. No further changes can be made.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className={cn("text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1", config.className)}>
              {config.label}
            </span>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {estimate.customer?.name || "Unknown Customer"}
            </h2>
            <p className="text-muted-foreground">{estimate.job?.name || "Unknown Job"}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${Number(estimate.total).toLocaleString()}
            </p>
            {estimate.expires_at && (
              <p className="text-sm text-muted-foreground">
                Expires {format(new Date(estimate.expires_at), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <button
          className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
          onClick={() => estimate.customer && navigate(`/customers/${estimate.customer.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Customer</p>
              <p className="text-sm text-muted-foreground">{estimate.customer?.name || "Unknown"}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>

        <button
          className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
          onClick={() => estimate.job && navigate(`/jobs/${estimate.job.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Calendar className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Job</p>
              <p className="text-sm text-muted-foreground">{estimate.job?.name || "Unknown"}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
      </div>

      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Line Items</h3>
        <div className="card-elevated rounded-lg overflow-hidden">
          {estimate.line_items.length > 0 ? (
            estimate.line_items
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4",
                    index < estimate.line_items.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.quantity} {item.unit} × ${Number(item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground ml-4">
                      ${Number(item.total).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No line items found
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="card-elevated rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${Number(estimate.subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({(Number(estimate.tax_rate) * 100).toFixed(0)}%)</span>
            <span className="text-foreground">${Number(estimate.tax).toLocaleString()}</span>
          </div>
          {Number(estimate.discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-[hsl(var(--status-confirmed))]">-${Number(estimate.discount).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-lg text-foreground">${Number(estimate.total).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {hasChangeOrders && (
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Change Orders</h3>
            <Badge variant="secondary">{estimate.change_orders!.length}</Badge>
          </div>
          <div className="card-elevated rounded-lg overflow-hidden">
            {estimate.change_orders!.map((changeOrder, index) => (
              <div
                key={changeOrder.id}
                className={cn(
                  "p-4",
                  index < estimate.change_orders!.length - 1 && "border-b border-border"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-foreground">{changeOrder.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(changeOrder.changed_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>${Number(changeOrder.previous_total).toLocaleString()}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-semibold text-foreground">
                    ${Number(changeOrder.new_total).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {estimate.notes && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{estimate.notes}</p>
          </div>
        </div>
      )}

      <div className="px-4 mt-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <div className="flex gap-3">
          {!estimate.is_finalized && (
            <>
              <Button variant="outline" className="flex-1 h-14 gap-2" onClick={handleSend}>
                <Send className="h-4 w-4" />
                Send
              </Button>
              <Button className="flex-1 h-14 gap-2" onClick={handleConvertToInvoice}>
                <ArrowRightLeft className="h-4 w-4" />
                Convert to Invoice
              </Button>
            </>
          )}
          {estimate.is_finalized && (
            <div className="w-full text-center py-4">
              <p className="text-sm text-muted-foreground">
                This estimate has been finalized
              </p>
            </div>
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
