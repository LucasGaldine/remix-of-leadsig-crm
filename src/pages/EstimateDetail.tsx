// @ts-nocheck
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ArrowRightLeft, User, Calendar, ChevronRight, CircleAlert as AlertCircle, History, CreditCard as Edit2, Link2, Copy, CheckCheck, CreditCard, FileCheck, Download, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEstimate } from "@/hooks/useEstimates";
import { useInvoices } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { generateEstimatePDF } from "@/lib/pdfGenerator";
import { EditEstimateModal } from "@/components/payments/EditEstimateModal";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", className: "status-pending" },
  viewed: { label: "Viewed", className: "status-paid" },
  accepted: { label: "Approved", className: "status-confirmed" },
  expired: { label: "Expired", className: "status-attention" },
  declined: { label: "Declined", className: "bg-red-100 text-red-800" },
};


export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: estimate, isLoading } = useEstimate(id);
  const { data: allInvoices } = useInvoices();

  const relatedInvoices = allInvoices?.filter(inv => inv.estimate_id === id) || [];

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualApproving, setManualApproving] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);

  const handleDownloadPDF = () => {
    if (!estimate) return;

    const activeLineItems = estimate.line_items.filter(
      (item: any) => !item.is_change_order || item.change_order_type !== "deleted"
    );

    generateEstimatePDF({
      customerName: estimate.customer?.name || "Unknown Customer",
      jobName: estimate.job?.name || "",
      address: estimate.job?.address || "",
      companyName: estimate.account?.company_name || "",
      companyEmail: estimate.account?.company_email || "",
      companyPhone: estimate.account?.company_phone || "",
      lineItems: activeLineItems.map((item: any) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total: item.total,
      })),
      subtotal: estimate.subtotal,
      taxRate: estimate.tax_rate,
      tax: estimate.tax,
      discount: estimate.discount,
      total: estimate.total,
      notes: estimate.notes,
      createdAt: estimate.created_at,
      expiresAt: estimate.expires_at,
    });

    toast.success("PDF downloaded");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Estimate" showBack backTo="/payments" />
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
        <PageHeader title="Estimate" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Estimate not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const config = statusConfig[estimate.status] || { label: estimate.status, className: "bg-secondary text-secondary-foreground" };
  const hasChangeOrders = estimate.line_items.some((item: any) => item.is_change_order);
  const isRecurringQuote = !!estimate.recurring_job_id && !estimate.job_id;
  const displayTitle = isRecurringQuote
    ? `${estimate.customer?.name || "Unknown"} Quote`
    : `${estimate.customer?.name || "Unknown"}, Estimate`;

  const hasOriginalEstimate = estimate.original_total != null && estimate.original_line_items;

  const displayLineItems = showingOriginal && hasOriginalEstimate
    ? estimate.original_line_items!
    : estimate.line_items.filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted');

  const displayTotal = showingOriginal && hasOriginalEstimate
    ? estimate.original_total!
    : estimate.total;

  const handleManualApprove = async () => {
    setManualApproving(true);
    try {
      const { error } = await supabase
        .from("estimates")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          approved_via: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["estimate", id] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Estimate marked as approved");
    } catch {
      toast.error("Failed to approve estimate");
    } finally {
      setManualApproving(false);
    }
  };

  const handleEstimateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["estimate", id] });
    await queryClient.invalidateQueries({ queryKey: ["estimates"] });
  };

  const handleGeneratePortalLink = async () => {
    setGeneratingLink(true);
    try {
      if (!estimate.customer?.id) {
        toast.error("No customer associated with this estimate");
        return;
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("client_portal_token")
        .eq("id", estimate.customer.id)
        .maybeSingle();

      let token = customer?.client_portal_token || null;

      if (!token) {
        token = crypto.randomUUID();
        const { error } = await supabase
          .from("customers")
          .update({ client_portal_token: token })
          .eq("id", estimate.customer.id);
        if (error) throw error;
      }

      const link = `${window.location.origin}/client/job?token=${token}`;
      setPortalLink(link);
    } catch {
      toast.error("Failed to generate client portal link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!portalLink) return;
    try {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCreateInvoice = () => {
    navigate(`/invoices/create?estimateId=${id}`);
  };

  const handleQuickEstimateSave = async (breakdown: QuickEstimateBreakdown) => {
    const { serviceType, measurements, result } = breakdown;
    const label = SERVICE_LABELS[serviceType];
    const qty = serviceType === "fencing"
      ? (measurements.linearFeet || 0)
      : (measurements.sqft || 0);
    const unit = serviceType === "fencing" ? "linear ft" : "sq ft";
    const overheadAmount = result.totalMid - result.laborTotal - result.materialTotal;

    const newItems = [
      { name: `${label} - Labor`, description: null as string | null, quantity: qty, unit, unit_price: qty > 0 ? parseFloat((result.laborTotal / qty).toFixed(2)) : 0 },
      { name: `${label} - Materials`, description: "Includes waste factor", quantity: qty, unit, unit_price: qty > 0 ? parseFloat((result.materialTotal / qty).toFixed(2)) : 0 },
      { name: "Overhead & Profit", description: null as string | null, quantity: 1, unit: "item", unit_price: parseFloat(overheadAmount.toFixed(2)) },
    ];

    try {
      const existingItems = estimate.line_items.filter(
        (item: any) => !item.is_change_order || item.change_order_type !== 'deleted'
      );
      for (const item of existingItems) {
        await supabase.from('estimate_line_items').delete().eq('id', item.id);
      }

      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const total = item.quantity * item.unit_price;
        const { error } = await supabase.from('estimate_line_items').insert({
          estimate_id: id,
          account_id: estimate.account_id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total,
          sort_order: i,
          is_change_order: false,
        });
        if (error) throw error;
      }

      const newSubtotal = newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const profitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
      const profitAmount = newSubtotal * (profitMargin / 100);
      const subtotalWithProfit = newSubtotal + profitAmount;
      const newTax = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
      const newTotal = subtotalWithProfit + newTax - parseFloat(estimate.discount.toString());

      await supabase
        .from('estimates')
        .update({ subtotal: newSubtotal, tax: newTax, total: newTotal, updated_at: new Date().toISOString() })
        .eq('id', id);

      await queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      await queryClient.invalidateQueries({ queryKey: ['estimates'] });

      setShowQuickEstimate(false);
      toast.success('Estimate updated from quick estimate');
    } catch (error) {
      console.error('Error saving quick estimate:', error);
      toast.error('Failed to save quick estimate');
    }
  };

  const enterEditMode = () => {
    const activeItems = estimate.line_items.filter(
      (item: any) => !item.is_change_order || item.change_order_type !== 'deleted'
    );

    setLineItems(
      activeItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        quantity: item.quantity.toString(),
        unit: item.unit,
        unit_price: item.unit_price.toString(),
      }))
    );
    setEditMode(true);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        name: '',
        description: '',
        quantity: '1',
        unit: 'item',
        unit_price: '',
        isNew: true,
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    const item = lineItems[index];
    if (item.id) {
      item.originalId = item.id;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      const shouldTrackChanges = estimate.status === 'accepted';

      const existingIds = new Set(
        estimate.line_items
          .filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted')
          .map((item: any) => item.id)
      );

      const currentIds = new Set(lineItems.filter((item) => item.id).map((item) => item.id));
      const deletedIds = Array.from(existingIds).filter((id) => !currentIds.has(id as string));

      // Handle deleted items
      if (shouldTrackChanges) {
        // Track as change order
        for (const deletedId of deletedIds) {
          const { error } = await supabase
            .from('estimate_line_items')
            .update({
              is_change_order: true,
              change_order_type: 'deleted',
              changed_at: new Date().toISOString(),
              change_order_approved: false,
            })
            .eq('id', deletedId);

          if (error) throw error;
        }
      } else {
        // Just delete the items
        for (const deletedId of deletedIds) {
          const { error } = await supabase
            .from('estimate_line_items')
            .delete()
            .eq('id', deletedId);

          if (error) throw error;
        }
      }

      for (const item of lineItems) {
        const quantity = parseFloat(item.quantity) || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const total = quantity * unitPrice;

        if (item.isNew) {
          if (shouldTrackChanges) {
            // Add as change order
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              is_change_order: true,
              change_order_type: 'added',
              changed_at: new Date().toISOString(),
              change_order_approved: false,
            });

            if (error) throw error;
          } else {
            // Add as normal item
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              is_change_order: false,
            });

            if (error) throw error;
          }
        } else if (item.id) {
          const original = estimate.line_items.find((li: any) => li.id === item.id);

          const normalizeValue = (val: any) => (val === null || val === undefined || val === '') ? null : val;

          const hasChanged =
            original &&
            (original.name !== item.name ||
              normalizeValue(original.description) !== normalizeValue(item.description) ||
              parseFloat(original.quantity) !== quantity ||
              original.unit !== item.unit ||
              parseFloat(original.unit_price) !== unitPrice);

          if (hasChanged) {
            if (shouldTrackChanges) {
              // Track as change order
              await supabase
                .from('estimate_line_items')
                .update({
                  is_change_order: true,
                  change_order_type: 'deleted',
                  changed_at: new Date().toISOString(),
                  change_order_approved: false,
                })
                .eq('id', item.id);

              const { error } = await supabase.from('estimate_line_items').insert({
                estimate_id: id,
                account_id: estimate.account_id,
                name: item.name,
                description: item.description || null,
                quantity,
                unit: item.unit,
                unit_price: unitPrice,
                total,
                sort_order: lineItems.indexOf(item),
                is_change_order: true,
                change_order_type: 'edited',
                original_line_item_id: item.id,
                changed_at: new Date().toISOString(),
                change_order_approved: false,
              });

              if (error) throw error;
            } else {
              // Just update the item
              const { error } = await supabase
                .from('estimate_line_items')
                .update({
                  name: item.name,
                  description: item.description || null,
                  quantity,
                  unit: item.unit,
                  unit_price: unitPrice,
                  total,
                  sort_order: lineItems.indexOf(item),
                })
                .eq('id', item.id);

              if (error) throw error;
            }
          }
        }
      }

      const activeItems = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', id)
        .or('is_change_order.is.null,and(is_change_order.eq.false),and(is_change_order.eq.true,change_order_type.neq.deleted)');

      if (activeItems.data) {
        const newSubtotal = activeItems.data.reduce(
          (sum, item) => sum + parseFloat(item.total.toString()),
          0
        );
        const profitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
        const profitAmount = newSubtotal * (profitMargin / 100);
        const subtotalWithProfit = newSubtotal + profitAmount;
        const newTax = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
        const newTotal = subtotalWithProfit + newTax - parseFloat(estimate.discount.toString());

        await supabase
          .from('estimates')
          .update({
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      await queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      await queryClient.invalidateQueries({ queryKey: ['estimates'] });

      if (shouldTrackChanges) {
        toast.success('Changes saved and tracked as change orders');
      } else {
        toast.success('Changes saved successfully');
      }
      setEditMode(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setLineItems([]);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-48">
      <PageHeader title={displayTitle} showBack backTo="/payments" />


      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1", config.className)}>
                {config.label}
              </span>
              {estimate.has_pending_changes && (
                <span className="text-2xs px-2 py-1 rounded-full inline-flex items-center gap-1 bg-amber-100 text-amber-800">
                  <AlertCircle className="h-3 w-3" />
                  Changes Pending Approval
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {estimate.customer?.name || "Unknown Customer"}
            </h2>
            <p className="text-muted-foreground">
              {isRecurringQuote
                ? (estimate.recurring_job?.name || "Job Schedule")
                : (estimate.job?.name || "Unknown Job")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${Number(displayTotal).toLocaleString()}
            </p>
            {estimate.expires_at && (
              <p className="text-sm text-muted-foreground">
                Expires {format(new Date(estimate.expires_at), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleDownloadPDF}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div
          className="w-full card-elevated rounded-lg p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Customer</p>
              <p className="text-sm text-muted-foreground">{estimate.customer?.name || "Unknown"}</p>
            </div>
          </div>
        </div>

        {isRecurringQuote ? (
          <div className="card-elevated rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Calendar className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Job Schedule</p>
                <p className="text-sm text-muted-foreground">{estimate.recurring_job?.name || "Unknown"}</p>
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {estimate.status === "accepted" && (
        <div className="px-4">
          <div className="card-elevated rounded-lg p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold text-foreground">Approved</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {(estimate as any).approved_via === "customer_link"
                ? "Approved by customer via approval link"
                : (estimate as any).approved_via === "manual"
                  ? "Manually marked as approved"
                  : "This estimate has been approved"}
              {estimate.accepted_at && (
                <> on {format(new Date(estimate.accepted_at), "MMM d, yyyy 'at' h:mm a")}</>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Line Items</h3>
          <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        {hasOriginalEstimate && (
          <div className="flex gap-2 mb-3">
            <Button
              variant={!showingOriginal ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setShowingOriginal(false)}
            >
              Modified
            </Button>
            <Button
              variant={showingOriginal ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setShowingOriginal(true)}
            >
              Original
            </Button>
          </div>
        )}

        <div className="card-elevated rounded-lg overflow-hidden">
          {displayLineItems.length > 0 ? (
            displayLineItems
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((item, index, arr) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4",
                    index < arr.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.is_change_order && item.changed_at && (() => {
                          const changedDate = new Date(item.changed_at);
                          const hoursSinceChange = (Date.now() - changedDate.getTime()) / (1000 * 60 * 60);
                          return hoursSinceChange < 24;
                        })() && (
                          <Badge
                            variant={
                              item.change_order_type === 'added' ? 'default' :
                              item.change_order_type === 'edited' ? 'secondary' :
                              'outline'
                            }
                            className="text-2xs"
                          >
                            {item.change_order_type === 'added' && 'New'}
                            {item.change_order_type === 'edited' && 'Modified'}
                          </Badge>
                        )}
                        {item.is_change_order && item.change_order_approved === false && (
                          <Badge
                            variant="outline"
                            className="text-2xs bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Pending Approval
                          </Badge>
                        )}
                        {item.is_change_order && item.change_order_approved === true && (
                          <Badge
                            variant="outline"
                            className="text-2xs bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                      </div>
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
          {Number(estimate.profit_margin) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profit Margin ({Number(estimate.profit_margin).toFixed(0)}%)</span>
              <span className="text-foreground">${(Number(estimate.subtotal) * (Number(estimate.profit_margin) / 100)).toLocaleString()}</span>
            </div>
          )}
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

      {estimate.has_pending_changes && (
        <div className="px-4 mt-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              This estimate has pending changes awaiting customer approval. Changes have been sent to the customer for review.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {hasChangeOrders && !estimate.has_pending_changes && (() => {
        const recentChanges = estimate.line_items.some((item: any) => {
          if (!item.is_change_order || !item.changed_at) return false;
          const changedDate = new Date(item.changed_at);
          const hoursSinceChange = (Date.now() - changedDate.getTime()) / (1000 * 60 * 60);
          return hoursSinceChange < 24;
        });

        if (!recentChanges) return null;

        return (
          <div className="px-4 mt-4">
            <Alert>
              <History className="h-4 w-4" />
              <AlertDescription>
                This estimate has been modified. Recent changes are marked with badges on the line items above.
              </AlertDescription>
            </Alert>
          </div>
        );
      })()}

      {estimate.notes && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{estimate.notes}</p>
          </div>
        </div>
      )}

      {relatedInvoices.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold text-foreground mb-2">Invoices</h3>
          <div className="space-y-2">
            {relatedInvoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => navigate(`/payments/invoices/${invoice.id}`)}
                className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground">
                        Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : ''}
                      </p>
                      <span className={cn(
                        "text-2xs px-2 py-1 rounded-full",
                        invoice.status === "paid" && "bg-emerald-100 text-emerald-800",
                        invoice.status === "sent" && "bg-blue-100 text-blue-800",
                        invoice.status === "draft" && "bg-secondary text-secondary-foreground",
                        invoice.status === "overdue" && "bg-red-100 text-red-800"
                      )}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                    {invoice.due_date && (
                      <p className="text-sm text-muted-foreground">
                        Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-foreground">${Number(invoice.total).toLocaleString()}</p>
                    {Number(invoice.balance_due) > 0 && (
                      <p className="text-sm text-muted-foreground">
                        ${Number(invoice.balance_due).toLocaleString()} due
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-2" />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Total Invoiced: ${relatedInvoices.reduce((sum, inv) => sum + Number(inv.total), 0).toLocaleString()} of ${Number(estimate.total).toLocaleString()}
          </div>
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
            {portalLink && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-3 mb-3 shadow-sm">
                <input
                  type="text"
                  readOnly
                  value={portalLink}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            <div className="flex gap-3">
              {estimate.status !== "accepted" && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-14 gap-2"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={manualApproving}
                  >
                    <Check className="h-4 w-4" />
                    {manualApproving ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    className="flex-1 h-14 gap-2"
                    onClick={handleGeneratePortalLink}
                    disabled={generatingLink}
                  >
                    <Link2 className="h-4 w-4" />
                    {generatingLink ? "Generating..." : "Client Portal"}
                  </Button>
                </>
              )}
              {estimate.status === "accepted" && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-14 gap-2"
                    onClick={handleGeneratePortalLink}
                    disabled={generatingLink}
                  >
                    <Link2 className="h-4 w-4" />
                    {generatingLink ? "Generating..." : "Client Portal"}
                  </Button>
                  <Button
                    className="flex-1 h-14 gap-2"
                    onClick={handleCreateInvoice}
                  >
                    <FileCheck className="h-4 w-4" />
                    Create Invoice
                  </Button>
                </>
              )}
            </div>
          </div>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRecurringQuote ? "Approve Quote" : "Approve Estimate"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurringQuote
                ? "Mark this quote as approved by the customer?"
                : "Mark this estimate as approved by the customer?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowApproveDialog(false); handleManualApprove(); }}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditEstimateModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        estimate={estimate}
        onSuccess={handleEstimateSuccess}
      />

      <MobileNav />
    </div>
  );
}
