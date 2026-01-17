import { useState } from "react";
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
  Edit2,
  Plus,
  X,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useEstimate } from "@/hooks/useEstimates";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const statusConfig = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  sent: { label: "Sent", className: "status-pending" },
  viewed: { label: "Viewed", className: "status-paid" },
  accepted: { label: "Accepted", className: "status-confirmed" },
  expired: { label: "Expired", className: "status-attention" },
};

interface LineItemForm {
  id?: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  isNew?: boolean;
  originalId?: string;
}

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: estimate, isLoading } = useEstimate(id);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);

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
  const hasChangeOrders = estimate.line_items.some((item: any) => item.is_change_order);

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

      // Check job status to determine if we should track changes
      const { data: jobData } = await supabase
        .from('leads')
        .select('status')
        .eq('id', estimate.job_id)
        .single();

      const isJob = jobData && ['won', 'scheduled', 'in_progress'].includes(jobData.status);

      const existingIds = new Set(
        estimate.line_items
          .filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted')
          .map((item: any) => item.id)
      );

      const currentIds = new Set(lineItems.filter((item) => item.id).map((item) => item.id));
      const deletedIds = Array.from(existingIds).filter((id) => !currentIds.has(id as string));

      // Handle deleted items
      if (isJob) {
        // Track as change order
        for (const deletedId of deletedIds) {
          const { error } = await supabase
            .from('estimate_line_items')
            .update({
              is_change_order: true,
              change_order_type: 'deleted',
              changed_at: new Date().toISOString(),
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
          if (isJob) {
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

          const hasChanged =
            original &&
            (original.name !== item.name ||
              original.description !== item.description ||
              parseFloat(original.quantity) !== quantity ||
              original.unit !== item.unit ||
              parseFloat(original.unit_price) !== unitPrice);

          if (hasChanged) {
            if (isJob) {
              // Track as change order
              await supabase
                .from('estimate_line_items')
                .update({
                  is_change_order: true,
                  change_order_type: 'deleted',
                  changed_at: new Date().toISOString(),
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
        const newTax = newSubtotal * parseFloat(estimate.tax_rate.toString());
        const newTotal = newSubtotal + newTax - parseFloat(estimate.discount.toString());

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

      if (isJob) {
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Line Items</h3>
          {!estimate.is_finalized && !editMode && (
            <Button variant="outline" size="sm" onClick={enterEditMode}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        {!editMode ? (
          <div className="card-elevated rounded-lg overflow-hidden">
            {estimate.line_items.filter((item: any) =>
              !item.is_change_order || item.change_order_type !== 'deleted'
            ).length > 0 ? (
              estimate.line_items
                .filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted')
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
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.is_change_order && (
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
        ) : (
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="card-elevated rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Item {index + 1}
                  </span>
                  {lineItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`name-${index}`}>Title *</Label>
                  <Input
                    id={`name-${index}`}
                    value={item.name}
                    onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                    placeholder="Service or product name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${index}`}>Description</Label>
                  <Textarea
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${index}`}>Quantity *</Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`unit-${index}`}>Unit</Label>
                    <Input
                      id={`unit-${index}`}
                      value={item.unit}
                      onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                      placeholder="item, sqft, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`unit-price-${index}`}>Unit Price *</Label>
                  <Input
                    id={`unit-price-${index}`}
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {item.quantity && item.unit_price && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Line Total:</span>
                      <span className="font-semibold">
                        ${(parseFloat(item.quantity) * parseFloat(item.unit_price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={addLineItem}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={saveChanges}
                disabled={saving || !lineItems.some(item => item.name && item.unit_price)}
              >
                {saving ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
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

      {hasChangeOrders && !editMode && (
        <div className="px-4 mt-4">
          <Alert>
            <History className="h-4 w-4" />
            <AlertDescription>
              This estimate has been modified. Change orders are marked with badges on the line items above.
            </AlertDescription>
          </Alert>
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

      {!editMode && (
        <>
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
        </>
      )}

      <MobileNav />
    </div>
  );
}
