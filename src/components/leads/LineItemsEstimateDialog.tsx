import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { QuickEstimateLineItem } from "./QuickEstimateLineItem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { LineItemCategory } from "@/hooks/useJobLineItems";


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

export function LineItemsEstimateDialog({ open, onOpenChange, lead, onSuccess, initialLineItems }: LineItemsEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const defaultLineItems: EstimateLineItemInit[] = initialLineItems ??
    (lead.estimated_value
      ? [{ name: lead.service_type || "Service", description: "", quantity: "1", unit: "item", unit_price: lead.estimated_value.toString(), category: "other" }]
      : [{ name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" }]);

  const [lineItems, setLineItems] = useState<EstimateLineItemInit[]>(defaultLineItems);
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setLineItems(defaultLineItems);
      setProfitMargin(String(currentAccount?.default_profit_margin ?? 0));
    }
  }, [open, currentAccount?.default_profit_margin]);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof EstimateLineItemInit, value: string) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const calculateSubtotal = () => {
    return lineItems
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

  const calculateSubtotalAfterProfit = () => {
    return calculateSubtotal() + calculateProfit();
  };

  const calculateTax = () => {
    const subtotalAfterProfit = calculateSubtotalAfterProfit();
    const taxRate = (currentAccount?.default_tax_rate ?? 0) / 100;
    return subtotalAfterProfit * taxRate;
  };

  const calculateTotal = () => {
    return calculateSubtotalAfterProfit() + calculateTax();
  };

  const handleCreate = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    const validLineItems = lineItems.filter(item => item.name && item.unit_price);
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
      const subtotalAfterProfit = estimateSubtotal + profitAmount;
      const taxRatePercent = currentAccount?.default_tax_rate ?? 0;
      const taxRate = taxRatePercent / 100;
      const taxAmount = subtotalAfterProfit * taxRate;
      const estimateTotal = subtotalAfterProfit + taxAmount;

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
                      leadId={lead.id}
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
                      ${((parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0")).toFixed(2))}
                    </span>
                  </div>
                </div>
              </div>
            ))}

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
            disabled={creating || !lineItems.some(item => item.name && item.unit_price)}
          >
            {creating ? "Creating..." : "Create Estimate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
