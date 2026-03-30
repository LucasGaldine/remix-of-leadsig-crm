import { useEffect, useState } from "react";
import { Plus, X, Check, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpeechToTextTextarea } from "@/components/ui/speech-to-text-textarea";
import { QuickEstimateLineItem } from "./QuickEstimateLineItem";
import { LineItemCategory } from "@/hooks/useJobLineItems";

function formatDollar(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface EstimateLineItem {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: LineItemCategory;
}

interface EstimateLineItemsEditorProps {
  leadId: string;
  lineItems: EstimateLineItem[];
  pendingDeleteIndices: Set<number>;
  expandedIndex: number | null;
  profitMargin: string;
  surcharge: string;
  defaultTaxRate: number;
  onExpandLineItem: (index: number) => void;
  onCollapseExpandedLineItem: () => void;
  onRevertLineItem: (index: number) => void;
  onMarkForDelete: (index: number) => void;
  onUndoDelete: (index: number) => void;
  onUpdateLineItem: (index: number, field: keyof EstimateLineItem, value: string) => void;
  onAddLineItem: () => void;
  onProfitMarginChange: (value: string) => void;
  onSurchargeChange: (value: string) => void;
}

function CompactLineItem({
  item,
  index,
  pendingDelete,
  onExpand,
  onRemove,
  onUndoRemove,
}: {
  item: EstimateLineItem;
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
  item: EstimateLineItem;
  index: number;
  leadId: string;
  onUpdate: (field: keyof EstimateLineItem, value: string) => void;
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
        <SpeechToTextTextarea
          id={`item-description-${index}`}
          value={item.description}
          onValueChange={(value) => onUpdate("description", value)}
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

export function EstimateLineItemsEditor({
  leadId,
  lineItems,
  pendingDeleteIndices,
  expandedIndex,
  profitMargin,
  surcharge,
  defaultTaxRate,
  onExpandLineItem,
  onCollapseExpandedLineItem,
  onRevertLineItem,
  onMarkForDelete,
  onUndoDelete,
  onUpdateLineItem,
  onAddLineItem,
  onProfitMarginChange,
  onSurchargeChange,
}: EstimateLineItemsEditorProps) {
  const activeLineItems = lineItems.filter((_, i) => !pendingDeleteIndices.has(i));

  const calculateSubtotal = () => {
    return activeLineItems
      .filter((item) => item.unit_price && item.quantity)
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
    const taxRate = defaultTaxRate / 100;
    return subtotalAfterAdjustments * taxRate;
  };

  const calculateTotal = () => {
    return calculateSubtotalAfterAdjustments() + calculateTax();
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Line Items *</Label>

      {lineItems.map((item, index) =>
        expandedIndex === index && !pendingDeleteIndices.has(index) ? (
          <ExpandedLineItem
            key={index}
            item={item}
            index={index}
            leadId={leadId}
            onUpdate={(field, value) => onUpdateLineItem(index, field, value)}
            onCollapse={onCollapseExpandedLineItem}
            onRevert={() => onRevertLineItem(index)}
            onRemove={() => onMarkForDelete(index)}
          />
        ) : (
          <CompactLineItem
            key={index}
            item={item}
            index={index}
            pendingDelete={pendingDeleteIndices.has(index)}
            onExpand={() => onExpandLineItem(index)}
            onRemove={() => onMarkForDelete(index)}
            onUndoRemove={() => onUndoDelete(index)}
          />
        )
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddLineItem}
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
                onChange={(e) => onProfitMarginChange(e.target.value)}
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
                onChange={(e) => onSurchargeChange(e.target.value)}
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
            Tax ({defaultTaxRate}%):
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
  );
}
