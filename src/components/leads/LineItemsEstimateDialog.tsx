import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Check, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { QuickEstimateLineItem } from "./QuickEstimateLineItem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { LineItemCategory } from "@/hooks/useJobLineItems";

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface EstimateLineItemInit {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: LineItemCategory;
}

interface LineItemsEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    service_type: string | null;
    estimated_value: number | null;
  };
  onSuccess: () => void;
  initialLineItems?: EstimateLineItemInit[];
}

function CompactLineItem({
  item,
  index,
  pendingDelete,
  onExpand,
  onRemove,
  onUndoRemove,
}: {
  item: EstimateLineItemInit;
  index: number;
  pendingDelete: boolean;
  onExpand: () => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}) {
  const lineTotal = parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0");

  if (pendingDelete) {
    return (
      <div className="p-3 border border-destructive/30 rounded-lg flex items-center justify-between gap-3 bg-destructive/5">
        <div className="flex-1 min-w-0 opacity-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate line-through">
              {item.name || `Item ${index + 1}`}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap line-through">
              {item.quantity} x ${formatDollar(parseFloat(item.unit_price || "0"))}
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
            {item.quantity} x ${formatDollar(parseFloat(item.unit_price || "0"))}
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
  leadId,
  onUpdate,
  onCollapse,
  onRevert,
  onRemove,
}: {
  item: EstimateLineItemInit;
  index: number;
  leadId: string;
  onUpdate: (field: keyof EstimateLineItemInit, value: string) => void;
  onCollapse: () => void;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const [priceDisplay, setPriceDisplay] = useState(
    item.unit_price ? formatDollar(parseFloat(item.unit_price)) : ""
  );
  const [isFocused, setIsFocused] = useState(false);
  const lineTotal = parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0");

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
            leadId={leadId}
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
        <Label htmlFor={`item-name-${index}`}>Title *</Label>
        <Input
          id={`item-name-${index}`}
          value={item.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="e.g., Paver Installation"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`item-description-${index}`}>Description</Label>
        <Textarea
          id={`item-description-${index}`}
          value={item.description}
          onChange={(e) => onUpdate("description", e.target.value)}
          placeholder="Additional details..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`item-category-${index}`}>Category</Label>
        <Select
          value={item.category}
          onValueChange={(value) => onUpdate("category", value)}
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
            onChange={(e) => onUpdate("quantity", e.target.value)}
            placeholder="1"
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`item-unit-${index}`}>Unit</Label>
          <Select
            value={item.unit}
            onValueChange={(value) => onUpdate("unit", value)}
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
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id={`item-price-${index}`}
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

export function LineItemsEstimateDialog({ open, onOpenChange, lead, onSuccess, initialLineItems }: LineItemsEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const defaultLineItems: EstimateLineItemInit[] = initialLineItems ??
    (lead.estimated_value
      ? [{ name: lead.service_type || "Service", description: "", quantity: "1", unit: "item", unit_price: lead.estimated_value.toString(), category: "other" }]
      : [{ name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" }]);

  const [lineItems, setLineItems] = useState<EstimateLineItemInit[]>(defaultLineItems);
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<Set<number>>(new Set());
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [surcharge, setSurcharge] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [snapshots, setSnapshots] = useState<Record<number, EstimateLineItemInit>>({});

  useEffect(() => {
    if (open) {
      setLineItems(defaultLineItems);
      setPendingDeleteIndices(new Set());
      setProfitMargin(String(currentAccount?.default_profit_margin ?? 0));
      setSurcharge(String(currentAccount?.default_surcharge ?? 0));
      setExpandedIndex(0);
      setSnapshots({});
    }
  }, [open, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

  const addLineItem = () => {
    const newItems = [...lineItems, { name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" as LineItemCategory }];
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

  const updateLineItem = (index: number, field: keyof EstimateLineItemInit, value: string) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const activeLineItems = lineItems.filter((_, i) => !pendingDeleteIndices.has(i));

  const calculateSubtotal = () => {
    return activeLineItems
      .filter(item => item.unit_price && item.quantity)
      .reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || "0");
        const unitPrice = parseFloat(item.unit_price || "0");
        return sum + (quantity * unitPrice);
      }, 0);
  };

  const calculateProfit = () => {
    const subtotal = calculateSubtotal();
    const margin = (parseFloat(profitMargin) || 0) / 100;
    return subtotal * margin;
  };

  const calculateSurcharge = () => {
    const subtotal = calculateSubtotal();
    const rate = (parseFloat(surcharge) || 0) / 100;
    return subtotal * rate;
  };

  const calculateSubtotalAfterAdjustments = () => {
    return calculateSubtotal() + calculateProfit() + calculateSurcharge();
  };

  const calculateTax = () => {
    const subtotalAfterAdjustments = calculateSubtotalAfterAdjustments();
    const taxRate = (currentAccount?.default_tax_rate ?? 0) / 100;
    return subtotalAfterAdjustments * taxRate;
  };

  const calculateTotal = () => {
    return calculateSubtotalAfterAdjustments() + calculateTax();
  };

  const handleCreate = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    const validLineItems = activeLineItems.filter(item => item.name && item.unit_price);
    if (validLineItems.length === 0) {
      toast.error("At least one line item is required");
      return;
    }

    setCreating(true);
    const loadingToast = toast.loading("Creating estimate...");

    try {
      const { id: customerId } = await findOrCreateCustomer({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address || lead.city,
        city: lead.city,
        created_by: user.id,
        account_id: currentAccount.id,
      });


      const estimateSubtotal = validLineItems.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || "1");
        const unitPrice = parseFloat(item.unit_price);
        return sum + (quantity * unitPrice);
      }, 0);

      const profitMarginPercent = parseFloat(profitMargin) || 0;
      const profitMarginValue = profitMarginPercent / 100;
      const profitAmount = estimateSubtotal * profitMarginValue;
      const surchargePercent = parseFloat(surcharge) || 0;
      const surchargeValue = surchargePercent / 100;
      const surchargeAmount = estimateSubtotal * surchargeValue;
      const subtotalAfterAdjustments = estimateSubtotal + profitAmount + surchargeAmount;
      const taxRatePercent = currentAccount?.default_tax_rate ?? 0;
      const taxRate = taxRatePercent / 100;
      const taxAmount = subtotalAfterAdjustments * taxRate;
      const estimateTotal = subtotalAfterAdjustments + taxAmount;

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          customer_id: customerId,
          estimated_value: estimateTotal,
        })
        .eq("id", lead.id);

      if (updateError) throw new Error("Failed to attach customer to lead");

      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          customer_id: customerId,
          job_id: lead.id,
          subtotal: estimateSubtotal,
          profit_margin: profitMarginPercent,
          surcharge: surchargePercent,
          tax_rate: taxRate,
          tax: taxAmount,
          discount: 0,
          total: estimateTotal,
          status: "draft",
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (estimateError) throw new Error("Failed to create estimate");

      const lineItemsToInsert = validLineItems.map((item, index) => {
        const quantity = parseFloat(item.quantity || "1");
        const unitPrice = parseFloat(item.unit_price);
        const total = quantity * unitPrice;

        return {
          estimate_id: estimateData.id,
          account_id: currentAccount.id,
          name: item.name,
          description: item.description || null,
          quantity,
          unit: item.unit,
          unit_price: unitPrice,
          total,
          sort_order: index,
          category: item.category,
        };
      });

      const { error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw new Error("Failed to create line items");

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: "Estimate created",
        body: `Estimate created with ${validLineItems.length} line items totaling $${estimateTotal.toFixed(2)}`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Estimate created! Send it to the customer for approval.");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating estimate:", error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to create estimate");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Estimate</DialogTitle>
          <DialogDescription>
            Add line items for this estimate. The total will be calculated automatically.
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
                  leadId={lead.id}
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
                  ${calculateSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  ${calculateProfit().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  ${calculateSurcharge().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Tax ({currentAccount?.default_tax_rate ?? 0}%):
                </span>
                <span className="font-medium">
                  ${calculateTax().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold">
                  ${calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !activeLineItems.some(item => item.name && item.unit_price)}
          >
            {creating ? "Creating..." : "Create Estimate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
