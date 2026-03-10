import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface EditEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: any;
  onSuccess: () => void;
}

export function EditEstimateModal({ open, onOpenChange, estimate, onSuccess }: EditEstimateModalProps) {
  const [saving, setSaving] = useState(false);
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
    const profitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
    const profitAmount = subtotal * (profitMargin / 100);
    const subtotalWithProfit = subtotal + profitAmount;
    const taxAmount = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
    const discountAmount = parseFloat(estimate.discount.toString());
    const total = subtotalWithProfit + taxAmount - discountAmount;

    return { subtotal, taxAmount, discountAmount, total };
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

  const { subtotal, taxAmount, discountAmount, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Estimate</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Line Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <Card key={index} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-700">Item {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Item Name *</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateLineItem(index, "name", e.target.value)}
                            placeholder="Labor, Materials, etc."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(index, "description", e.target.value)}
                            placeholder="Item description..."
                            className="min-h-20"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Unit</Label>
                            <Select
                              value={item.unit}
                              onValueChange={(value) => updateLineItem(index, "unit", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="each">Each</SelectItem>
                                <SelectItem value="hour">Hour</SelectItem>
                                <SelectItem value="sq ft">Sq Ft</SelectItem>
                                <SelectItem value="linear ft">Linear Ft</SelectItem>
                                <SelectItem value="day">Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Total</Label>
                            <Input
                              type="text"
                              value={`$${calculateLineItemTotal(item.quantity, item.unit_price).toFixed(2)}`}
                              disabled
                              className="bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Totals</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-lg">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>

                {Number(estimate.profit_margin) > 0 && (
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-gray-600">Profit Margin ({Number(estimate.profit_margin).toFixed(0)}%):</span>
                    <span className="font-semibold">${(subtotal * (Number(estimate.profit_margin) / 100)).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-lg">
                  <span className="text-gray-600">Tax ({(Number(estimate.tax_rate) * 100).toFixed(0)}%):</span>
                  <span className="font-semibold">${taxAmount.toFixed(2)}</span>
                </div>

                {Number(estimate.discount) > 0 && (
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-semibold">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-2xl">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-emerald-700">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {saving ? "Saving..." : (estimate.status === 'accepted' ? 'Send Change Order' : 'Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
