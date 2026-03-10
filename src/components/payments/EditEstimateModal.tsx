import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QuickEstimateLineItem } from "@/components/leads/QuickEstimateLineItem";
import { LineItemCategory } from "@/hooks/useJobLineItems";

interface LineItemForm {
  id?: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: LineItemCategory;
  isNew?: boolean;
  originalId?: string;
}

interface EditEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: any;
  onSuccess: () => void;
}

export function EditEstimateModal({ open, onOpenChange, estimate, onSuccess }: EditEstimateModalProps) {
  const [saving, setSaving] = useState(false);
  const [profitMargin, setProfitMargin] = useState<string>(() => {
    return (estimate.profit_margin || 0).toString();
  });
  const [lineItems, setLineItems] = useState<LineItemForm[]>(() => {
    const activeItems = estimate.line_items.filter(
      (item: any) => !item.is_change_order || item.change_order_type !== 'deleted'
    );
    return activeItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      quantity: item.quantity.toString(),
      unit: item.unit,
      unit_price: item.unit_price.toString(),
      category: item.category || 'other',
    }));
  });

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        name: '',
        description: '',
        quantity: '1',
        unit: 'each',
        unit_price: '',
        category: 'other',
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
    if (lineItems.length === 1) {
      toast.error("You must have at least one line item");
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateLineItemTotal = (quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + calculateLineItemTotal(item.quantity, item.unit_price);
    }, 0);
    const profitMarginValue = parseFloat(profitMargin || '0') / 100;
    const profitAmount = subtotal * profitMarginValue;
    const subtotalWithProfit = subtotal + profitAmount;
    const taxAmount = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
    const discountAmount = parseFloat(estimate.discount.toString());
    const total = subtotalWithProfit + taxAmount - discountAmount;

    return { subtotal, profitAmount, taxAmount, discountAmount, total };
  };

  const saveChanges = async () => {
    if (lineItems.length === 0 || lineItems.every(item => !item.name)) {
      toast.error("Please add at least one line item with a name");
      return;
    }

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

      if (shouldTrackChanges) {
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
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: estimate.id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              category: item.category,
              is_change_order: true,
              change_order_type: 'added',
              changed_at: new Date().toISOString(),
              change_order_approved: false,
            });

            if (error) throw error;
          } else {
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: estimate.id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              category: item.category,
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
              parseFloat(original.unit_price) !== unitPrice ||
              (original.category || 'other') !== item.category);

          if (hasChanged) {
            if (shouldTrackChanges) {
              const { error } = await supabase.from('estimate_line_items').update({
                is_change_order: true,
                change_order_type: 'edited',
                changed_at: new Date().toISOString(),
                change_order_approved: false,
                name: item.name,
                description: item.description || null,
                quantity,
                unit: item.unit,
                unit_price: unitPrice,
                total,
                category: item.category,
              }).eq('id', item.id);

              if (error) throw error;
            } else {
              const { error } = await supabase.from('estimate_line_items').update({
                name: item.name,
                description: item.description || null,
                quantity,
                unit: item.unit,
                unit_price: unitPrice,
                total,
                category: item.category,
              }).eq('id', item.id);

              if (error) throw error;
            }
          }
        }
      }

      const { data: activeItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimate.id)
        .or('is_change_order.is.null,and(is_change_order.eq.false),and(is_change_order.eq.true,change_order_type.neq.deleted)');

      if (activeItems && activeItems.length > 0) {
        const newSubtotal = activeItems.reduce(
          (sum, item) => sum + parseFloat(item.total.toString()),
          0
        );
        const profitMarginValue = parseFloat(profitMargin || '0') / 100;
        const profitAmount = newSubtotal * profitMarginValue;
        const subtotalWithProfit = newSubtotal + profitAmount;
        const newTax = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
        const newTotal = subtotalWithProfit + newTax - parseFloat(estimate.discount.toString());

        await supabase
          .from('estimates')
          .update({
            subtotal: newSubtotal,
            profit_margin: parseFloat(profitMargin || '0'),
            tax: newTax,
            total: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estimate.id);
      }

      if (shouldTrackChanges) {
        toast.success('Changes saved and tracked as change orders');
      } else {
        toast.success('Changes saved successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const { subtotal, profitAmount, taxAmount, discountAmount, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Estimate</DialogTitle>
          <DialogDescription>
            Update line items for this estimate. The total will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <QuickEstimateLineItem
                      leadId={estimate.job_id}
                      onApply={(name, quantity, unit, unitPrice, description) => {
                        updateLineItem(index, "name", name);
                        updateLineItem(index, "quantity", quantity);
                        updateLineItem(index, "unit", unit);
                        updateLineItem(index, "unit_price", unitPrice);
                        updateLineItem(index, "description", description);
                      }}
                    />
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-name-${index}`}>Title *</Label>
                  <Input
                    id={`item-name-${index}`}
                    value={item.name}
                    onChange={(e) => updateLineItem(index, "name", e.target.value)}
                    placeholder="e.g., Paver Installation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-description-${index}`}>Description</Label>
                  <Textarea
                    id={`item-description-${index}`}
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-category-${index}`}>Category</Label>
                  <Select
                    value={item.category}
                    onValueChange={(value) => updateLineItem(index, "category", value)}
                  >
                    <SelectTrigger id={`item-category-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="materials">Materials</SelectItem>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`item-quantity-${index}`}>Quantity *</Label>
                    <Input
                      id={`item-quantity-${index}`}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      placeholder="1"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`item-unit-${index}`}>Unit</Label>
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateLineItem(index, "unit", value)}
                    >
                      <SelectTrigger id={`item-unit-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="item">Item</SelectItem>
                        <SelectItem value="each">Each</SelectItem>
                        <SelectItem value="hour">Hour</SelectItem>
                        <SelectItem value="sq ft">Sq Ft</SelectItem>
                        <SelectItem value="linear ft">Linear Ft</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-price-${index}`}>Unit Price *</Label>
                  <Input
                    id={`item-price-${index}`}
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Line Total:</span>
                    <span className="font-semibold">
                      ${calculateLineItemTotal(item.quantity, item.unit_price).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-secondary p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Profit Margin:</span>
                  <div className="relative w-20">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={profitMargin}
                      onChange={(e) => setProfitMargin(e.target.value)}
                      className="h-7 text-xs pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <span className="font-medium">
                  ${profitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Tax ({(parseFloat(estimate.tax_rate.toString()) * 100).toFixed(0)}%):
                </span>
                <span className="font-medium">
                  ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="font-medium">
                    -${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold">
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={saveChanges}
            disabled={saving}
          >
            {saving ? "Saving..." : (estimate.status === 'accepted' ? 'Send Change Order' : 'Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
