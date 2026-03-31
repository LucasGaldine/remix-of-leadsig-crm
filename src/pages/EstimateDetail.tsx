// @ts-nocheck
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ArrowRightLeft, User, Calendar, Briefcase, ChevronRight, CircleAlert as AlertCircle, History, Pencil as Edit2, Link2, Copy, CheckCheck, CreditCard, Download, Check, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useEstimate } from "@/hooks/useEstimates";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { generateEstimatePDF } from "@/lib/pdfGenerator";
import { EditEstimateModal } from "@/components/payments/EditEstimateModal";
import { JobInvoiceCard } from "@/components/jobs/JobInvoiceCard";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  draft: { label: "Draft", icon: Edit2, className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", icon: Send, className: "status-pending" },
  viewed: { label: "Viewed", icon: CheckCheck, className: "status-paid" },
  accepted: { label: "Approved", icon: Check, className: "status-confirmed" },
  expired: { label: "Expired", icon: AlertCircle, className: "status-attention" },
  declined: { label: "Declined", icon: AlertCircle, className: "bg-red-100 text-red-800" },
};

const CATEGORY_ORDER = ["equipment", "materials", "labor", "other"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  equipment: "Equipment",
  materials: "Materials",
  labor: "Labor",
  other: "Other",
};

const normalizeCategory = (category?: string) =>
  CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])
    ? (category as (typeof CATEGORY_ORDER)[number])
    : "other";


export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: estimate, isLoading } = useEstimate(id);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualApproving, setManualApproving] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(() => new Set());

  const handleDownloadPDF = async () => {
    if (!estimate) return;

    const activeLineItems = estimate.line_items.filter(
      (item: any) => !item.is_change_order || item.change_order_type !== "deleted"
    );

    await generateEstimatePDF({
      customerName: estimate.customer?.name || "Unknown Customer",
      jobName: estimate.job?.name || "",
      address: estimate.job?.address || "",
      companyName: estimate.account?.company_name || "",
      companyLogoUrl: estimate.account?.logo_url || "",
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
        <PageHeader title="" showBack backTo="/payments" />
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
        <PageHeader title="" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Estimate not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const config = statusConfig[estimate.status] || { label: estimate.status, icon: AlertCircle };
  const StatusIcon = config.icon;
  const hasChangeOrders = estimate.line_items.some((item: any) => item.is_change_order);
  const isRecurringQuote = !!estimate.recurring_job_id && !estimate.job_id;
  const jobStatusLabelMap: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    "in-progress": "In Progress",
    completed: "Completed",
    paid: "Paid",
  };
  const getJobStatusBadgeStatus = (status: string) => {
    switch (status) {
      case "unscheduled":
        return "unscheduled";
      case "unassigned":
      case "needs_invoice":
        return "attention";
      case "scheduled":
        return "scheduled";
      case "in_progress":
      case "in-progress":
        return "in_progress";
      case "completed":
      case "paid":
        return "completed";
      case "job":
        return "job";
      default:
        return "pending";
    }
  };
  const deriveJobStatus = () => {
    const directStatus =
      estimate.job?.display_status ||
      estimate.job?.status ||
      (estimate.recurring_job as any)?.display_status ||
      (estimate.recurring_job as any)?.status;

    if (directStatus !== "job") {
      return directStatus || "unscheduled";
    }

    // Raw "job" is ambiguous on lead records; infer a meaningful stage.
    const scheduledDate = estimate.job?.scheduled_date;
    if (!scheduledDate) return "unscheduled";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(`${scheduledDate}T00:00:00`);

    return scheduled > today ? "scheduled" : "in_progress";
  };
  const rawJobStatus = deriveJobStatus();
  const jobStatusLabel = jobStatusLabelMap[rawJobStatus] || rawJobStatus;
  const displayTitle = isRecurringQuote
    ? `${estimate.customer?.name || "Unknown"} Quote`
    : `${estimate.customer?.name || "Unknown"}, Estimate`;

  const hasOriginalEstimate = estimate.original_total != null && estimate.original_line_items;
  const showPendingChangesCard = estimate.has_pending_changes && !showingOriginal;
  const showApprovedCard =
    (estimate.status === "accepted" && !showPendingChangesCard) ||
    (estimate.has_pending_changes && showingOriginal);

  const displayLineItems = showingOriginal && hasOriginalEstimate
    ? estimate.original_line_items!
    : estimate.line_items.filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted');

  const displayTotal = showingOriginal && hasOriginalEstimate
    ? estimate.original_total!
    : estimate.total;

  const groupedLineItems = [...displayLineItems]
    .sort((a, b) => {
      const categoryDiff =
        CATEGORY_ORDER.indexOf(normalizeCategory(a.category)) -
        CATEGORY_ORDER.indexOf(normalizeCategory(b.category));

      if (categoryDiff !== 0) return categoryDiff;

      return (a.sort_order || 0) - (b.sort_order || 0);
    })
    .reduce(
      (groups, item) => {
        const category = normalizeCategory(item.category);
        const existingGroup = groups.find((group) => group.category === category);

        if (existingGroup) {
          existingGroup.items.push(item);
        } else {
          groups.push({ category, items: [item] });
        }

        return groups;
      },
      [] as Array<{ category: (typeof CATEGORY_ORDER)[number]; items: typeof displayLineItems }>,
    );

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
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/payments" />


      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 md:pt-8 pb-0">
        <div className="mb-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                estimate.status === "accepted"
                  ? "status-confirmed border-[hsl(var(--status-confirmed))]/40"
                  : "border-border bg-muted/60 text-muted-foreground"
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
            {estimate.has_pending_changes && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                <AlertCircle className="h-3 w-3 text-amber-700" />
                Changes Pending Approval
              </span>
            )}
          </div>
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
            data-testid="estimate-header-summary-row"
          >
            <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">
              {isRecurringQuote ? "Quote" : "Estimate"}
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
          <div
            className="flex flex-nowrap items-center justify-start gap-2"
            data-testid="estimate-header-quick-actions"
          >
              {portalLink && (
                <div className="hidden md:flex items-center gap-2 bg-card border border-border rounded-full px-3 py-2 shadow-sm">
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
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => setShowApproveDialog(true)}
                disabled={estimate.status === "accepted" || manualApproving}
              >
                <Check className="h-4 w-4" />
                {estimate.status === "accepted" ? "Approved" : manualApproving ? "Approving..." : "Approve"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={handleGeneratePortalLink}
                disabled={generatingLink}
              >
                <Link2 className="h-4 w-4" />
                {generatingLink ? "Generating..." : "Client Portal"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={handleDownloadPDF}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-[var(--content-max-width)] m-auto">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div className="space-y-4" data-testid="estimate-details-left-column">
            <div className="card-elevated rounded-lg overflow-hidden">
              <div className="p-4">
                {hasOriginalEstimate && (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Versions</h3>
                    </div>
                    <Tabs
                      value={showingOriginal ? "original" : "modified"}
                      onValueChange={(value) => setShowingOriginal(value === "original")}
                      className="mt-0"
                    >
                      <TabsList className="w-full justify-start rounded-none bg-transparent p-0">
                        <TabsTrigger
                          value="modified"
                          className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                          Modified
                        </TabsTrigger>
                        <TabsTrigger
                          value="original"
                          className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                          Original
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </>
                )}
                {showPendingChangesCard && (
                  <div className="mt-3">
                    <div data-testid="pending-changes-alert" className="rounded-md bg-amber-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-900">
                          This estimate has pending changes awaiting customer approval.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {showApprovedCard && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-semibold text-foreground">Approved</h4>
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
                )}
                <div data-testid="line-items-header-row" className="mt-3 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-foreground">Line Items</h4>
                  <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>

              {groupedLineItems.length > 0 ? (
                groupedLineItems.map((group, groupIndex) => (
                  <div key={group.category}>
                    <div
                      className="px-4 py-2 text-muted-foreground"
                    >
                      <p
                        className="text-xs uppercase tracking-wide"
                        data-testid="line-item-category-heading"
                      >
                        {CATEGORY_LABELS[group.category]}
                      </p>
                    </div>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-2"
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

                                >
                                  {item.change_order_type === 'added' && 'New'}
                                  {item.change_order_type === 'edited' && 'Modified'}
                                </Badge>
                              )}
                              {item.is_change_order && item.change_order_approved === false && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border-amber-200"
                                >
                                  Pending Approval
                                </Badge>
                              )}
                              {item.is_change_order && item.change_order_approved === true && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border-emerald-200"
                                >
                                  <CheckCheck className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                              )}
                            </div>
                            {item.description && (() => {
                              const descriptionId = item.id || `line-item-${groupIndex}-${itemIndex}`;
                              const hasLongDescription = item.description.trim().length > 180;
                              const isDescriptionExpanded = expandedDescriptions.has(descriptionId);
                              const toggleDescription = () => {
                                setExpandedDescriptions((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(descriptionId)) {
                                    next.delete(descriptionId);
                                  } else {
                                    next.add(descriptionId);
                                  }
                                  return next;
                                });
                              };

                              return (
                                <div className="mt-0.5">
                                  <p
                                    className={`text-sm text-muted-foreground break-words ${
                                      isDescriptionExpanded ? "" : "line-clamp-3"
                                    }`}
                                  >
                                    {item.description}
                                  </p>
                                  {hasLongDescription && (
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                                      onClick={toggleDescription}
                                    >
                                      {isDescriptionExpanded ? "View less" : "View more"}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="ml-4 text-right">
                            <p className="font-semibold text-foreground">
                              ${Number(item.total).toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.quantity} {item.unit} × ${Number(item.unit_price).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No line items found
                </div>
              )}

              <div className="mx-4 my-4 rounded-lg bg-secondary p-4 space-y-2">
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

              {estimate.notes && (
                <div className="p-4 border-t border-border">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Notes</h3>
                  <p className="text-sm text-muted-foreground mt-2">{estimate.notes}</p>
                </div>
              )}
            </div>

            {hasChangeOrders && !estimate.has_pending_changes && (() => {
              const recentChanges = estimate.line_items.some((item: any) => {
                if (!item.is_change_order || !item.changed_at) return false;
                const changedDate = new Date(item.changed_at);
                const hoursSinceChange = (Date.now() - changedDate.getTime()) / (1000 * 60 * 60);
                return hoursSinceChange < 24;
              });

              if (!recentChanges) return null;

              return (
                <Alert>
                  <History className="h-4 w-4" />
                  <AlertDescription>
                    This estimate has been modified. Recent changes are marked with badges on the line items above.
                  </AlertDescription>
                </Alert>
              );
            })()}

          </div>

          <div className="space-y-4" data-testid="estimate-details-right-column">
            <button
              className="w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))]"
              onClick={() => estimate.customer && navigate(`/customers/${estimate.customer.id}`)}
            >
              <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                <div className="flex gap-2 items-center">
                  <User className="w-3 h-3" />
                  <p className="text-xs uppercase tracking-wide">Client</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  View
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-semibold leading-tight text-foreground">
                  {estimate.customer?.name || "Unknown"}
                </p>
              </div>
            </button>

            {isRecurringQuote ? (
              <div className="w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm">
                <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                <div className="flex gap-2 items-center">
                    <Briefcase className="w-3 h-3" />
                  </div>
                  <StatusBadge status={getJobStatusBadgeStatus(rawJobStatus) as any}>
                    {jobStatusLabel}
                  </StatusBadge>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-semibold leading-tight text-foreground">
                    {estimate.recurring_job?.service_type || estimate.job?.service_type || (estimate as any).service_type || "No service type"}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs text-pretty">
                    {estimate.recurring_job?.name || "Unknown"}
                  </p>
                </div>
                <div className="mt-6">
                  <div className="w-full rounded-full bg-muted px-5 py-3 text-center font-semibold whitespace-nowrap text-foreground text-sm">
                    View Details
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))]"
                onClick={() => estimate.job && navigate(`/jobs/${estimate.job.id}`)}
              >
                <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                  <div className="flex gap-2 items-center">
                    <Briefcase className="w-3 h-3" />
                  </div>
                  <StatusBadge status={getJobStatusBadgeStatus(rawJobStatus) as any}>
                    {jobStatusLabel}
                  </StatusBadge>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-semibold leading-tight text-foreground">
                    {estimate.job?.service_type || (estimate as any).service_type || "No service type"}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs text-pretty">
                    {estimate.job?.name || "Unknown"}
                  </p>
                </div>
                <div className="mt-6">
                  <div className="w-full rounded-full bg-muted px-5 py-3 text-center font-semibold whitespace-nowrap text-foreground text-sm">
                    View Job
                  </div>
                </div>
              </button>
            )}

            {estimate.job_id ? (
              <JobInvoiceCard
                jobId={estimate.job_id}
                customerEmail={estimate.customer?.email}
                customerName={estimate.customer?.name}
                estimateTotal={Number(estimate.total)}
              />
            ) : (
              <div className="card-elevated rounded-lg p-4">
                <h3 className="font-semibold text-foreground">Invoices</h3>
                <p className="text-sm text-muted-foreground mt-3">
                  Invoices are available on job-based estimates.
                </p>
              </div>
            )}
          </div>
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
