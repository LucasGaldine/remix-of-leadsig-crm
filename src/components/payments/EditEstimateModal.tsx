import { useState, useEffect } from "react";
import { Plus, X, Check, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpeechToTextTextarea } from "@/components/ui/speech-to-text-textarea";
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

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function CompactLineItem({
  item,
  index,
  pendingDelete,
  onExpand,
  onRemove,
  onUndoRemove,
}: {
  item: LineItemForm;
  index: number;
  pendingDelete: boolean;
  onExpand: () => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}) {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unit_price) || 0;
  const lineTotal = qty * price;

  if (pendingDelete) {
    return (
      <div className="p-3 border border-destructive/30 rounded-lg flex items-center justify-between gap-3 bg-destructive/5">
        <div className="flex-1 min-w-0 opacity-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate line-through">
              {item.name || `Item ${index + 1}`}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap line-through">
              {item.quantity} x ${formatDollar(price)}
            </span>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground shrink-0" onClick={onUndoRemove}>
          <Undo2 className="h-3.5 w-3.5" />
          <span className="text-xs">Undo</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 border border-border rounded-lg flex items-center justify-between gap-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {item.name || `Item ${index + 1}`}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {item.quantity} x ${formatDollar(price)}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm font-semibold mr-1">${formatDollar(lineTotal)}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onExpand}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ExpandedLineItem({
  item,
  index,
  jobId,
  onUpdate,
  onCollapse,
  onRevert,
  onRemove,
  canRemove,
}: {
  item: LineItemForm;
  index: number;
  jobId: string;
  onUpdate: (field: keyof LineItemForm, value: string) => void;
  onCollapse: () => void;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const [priceDisplay, setPriceDisplay] = useState(
    item.unit_price ? formatDollar(parseFloat(item.unit_price)) : ""
  );
  const [isFocused, setIsFocused] = useState(false);
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unit_price) || 0;
  const lineTotal = qty * price;

  useEffect(() => {
    if (!isFocused) {
      setPriceDisplay(item.unit_price ? formatDollar(parseFloat(item.unit_price)) : "");
    }
  }, [item.unit_price, isFocused]);

  return (
    <div className="p-4 border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
        <div className="flex items-center gap-1">
          <QuickEstimateLineItem
            leadId={jobId}
            onApply={(name, quantity, unit, unitPrice, description) => {
              onUpdate("name", name);
              onUpdate("quantity", quantity);
              onUpdate("unit", unit);
              onUpdate("unit_price", unitPrice);
              onUpdate("description", description);
            }}
          />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-item-name-${index}`}>Title *</Label>
        <Input
          id={`edit-item-name-${index}`}
          value={item.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="e.g., Paver Installation"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-item-description-${index}`}>Description</Label>
        <SpeechToTextTextarea
          id={`edit-item-description-${index}`}
          value={item.description}
          onValueChange={(value) => onUpdate("description", value)}
          placeholder="Additional details..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-item-category-${index}`}>Category</Label>
        <Select
          value={item.category}
          onValueChange={(value) => onUpdate("category", value)}
        >
          <SelectTrigger id={`edit-item-category-${index}`}>
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
          <Label htmlFor={`edit-item-quantity-${index}`}>Quantity *</Label>
          <Input
            id={`edit-item-quantity-${index}`}
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate("quantity", e.target.value)}
            placeholder="1"
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`edit-item-unit-${index}`}>Unit</Label>
          <Select
            value={item.unit}
            onValueChange={(value) => onUpdate("unit", value)}
          >
            <SelectTrigger id={`edit-item-unit-${index}`}>
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
        <Label htmlFor={`edit-item-price-${index}`}>Unit Price *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id={`edit-item-price-${index}`}
            type="text"
            inputMode="decimal"
            value={priceDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              setPriceDisplay(e.target.value.replace(/[^0-9.,]/g, ""));
              onUpdate("unit_price", raw);
            }}
            onFocus={() => {
              setIsFocused(true);
              setPriceDisplay(item.unit_price || "");
            }}
            onBlur={() => {
              setIsFocused(false);
              const val = parseFloat(item.unit_price || "0");
              setPriceDisplay(val ? formatDollar(val) : "");
            }}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Line Total:</span>
          <span className="font-semibold">${formatDollar(lineTotal)}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onRevert}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Revert
          </Button>
          <Button type="button" variant="ghost" className="flex-1" onClick={onCollapse}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EditEstimateModal({ open, onOpenChange, estimate, onSuccess }: EditEstimateModalProps) {
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, LineItemForm>>({});
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<Set<number>>(new Set());
  const [profitMargin, setProfitMargin] = useState<string>(() => {
    return (estimate.profit_margin || 0).toString();
  });
  const [surcharge, setSurcharge] = useState<string>(() => {
    return (estimate.surcharge || 0).toString();
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
    const newItems = [
      ...lineItems,
      {
        name: '',
        description: '',
        quantity: '1',
        unit: 'each',
        unit_price: '',
        category: 'other' as LineItemCategory,
        isNew: true,
      },
    ];
    const newIndex = newItems.length - 1;
    setLineItems(newItems);
    setSnapshots(prev => ({ ...prev, [newIndex]: { ...newItems[newIndex] } }));
    setExpandedIndex(newIndex);
  };

  const expandLineItem = (index: number) => {
    setSnapshots(prev => ({ ...prev, [index]: { ...lineItems[index] } }));
    setExpandedIndex(index);
  };

  const revertLineItem = (index: number) => {
    const snapshot = snapshots[index];
    if (snapshot) {
      const updated = [...lineItems];
      updated[index] = { ...snapshot };
      setLineItems(updated);
    }
    setExpandedIndex(null);
  };

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const markForDelete = (index: number) => {
    setPendingDeleteIndices(prev => new Set(prev).add(index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const undoDelete = (index: number) => {
    setPendingDeleteIndices(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const calculateLineItemTotal = (quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const activeLineItems = lineItems.filter((_, i) => !pendingDeleteIndices.has(i));

  const calculateTotals = () => {
    const subtotal = activeLineItems.reduce((sum, item) => {
      return sum + calculateLineItemTotal(item.quantity, item.unit_price);
    }, 0);
    const profitMarginValue = parseFloat(profitMargin || '0') / 100;
    const profitAmount = subtotal * profitMarginValue;
    const surchargeValue = parseFloat(surcharge || '0') / 100;
    const surchargeAmount = subtotal * surchargeValue;
    const subtotalWithAdjustments = subtotal + profitAmount + surchargeAmount;
    const taxAmount = subtotalWithAdjustments * parseFloat(estimate.tax_rate.toString());
    const discountAmount = parseFloat(estimate.discount.toString());
    const total = subtotalWithAdjustments + taxAmount - discountAmount;

    return { subtotal, profitAmount, surchargeAmount, taxAmount, discountAmount, total };
  };

  const saveChanges = async () => {
    if (activeLineItems.length === 0 || activeLineItems.every(item => !item.name)) {
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

      const currentIds = new Set(activeLineItems.filter((item) => item.id).map((item) => item.id));
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

      for (const item of activeLineItems) {
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
        const surchargeValue = parseFloat(surcharge || '0') / 100;
        const surchargeAmount = newSubtotal * surchargeValue;
        const subtotalWithAdjustments = newSubtotal + profitAmount + surchargeAmount;
        const newTax = subtotalWithAdjustments * parseFloat(estimate.tax_rate.toString());
        const newTotal = subtotalWithAdjustments + newTax - parseFloat(estimate.discount.toString());

        await supabase
          .from('estimates')
          .update({
            subtotal: newSubtotal,
            profit_margin: parseFloat(profitMargin || '0'),
            surcharge: parseFloat(surcharge || '0'),
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

  const { subtotal, profitAmount, surchargeAmount, taxAmount, discountAmount, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100dvw-1rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Estimate</DialogTitle>
          <DialogDescription>
            Update line items for this estimate. The total will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Line Items *</Label>

            {lineItems.map((item, index) =>
              expandedIndex === index && !pendingDeleteIndices.has(index) ? (
                <ExpandedLineItem
                  key={index}
                  item={item}
                  index={index}
                  jobId={estimate.job_id}
                  onUpdate={(field, value) => updateLineItem(index, field, value)}
                  onCollapse={() => setExpandedIndex(null)}
                  onRevert={() => revertLineItem(index)}
                  onRemove={() => markForDelete(index)}
                />
              ) : (
                <CompactLineItem
                  key={index}
                  item={item}
                  index={index}
                  pendingDelete={pendingDeleteIndices.has(index)}
                  onExpand={() => expandLineItem(index)}
                  onRemove={() => markForDelete(index)}
                  onUndoRemove={() => undoDelete(index)}
                />
              )
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>

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
              <div className="flex justify-between items-center text-sm gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Surcharge:</span>
                  <div className="relative w-20">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={surcharge}
                      onChange={(e) => setSurcharge(e.target.value)}
                      className="h-7 text-xs pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <span className="font-medium">
                  ${surchargeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
