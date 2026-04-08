import { useState, useEffect, useMemo } from "react";
import type { DragEvent } from "react";
import { GripVertical, Plus, X, Check, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
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
  versionId?: string | null;
  onSuccess: () => void;
}

function normalizeTextValue(value: string | null | undefined) {
  return value === null || value === undefined || value === "" ? null : value;
}

function normalizeLineItemForComparison(item: Partial<LineItemForm> & { sort_order?: number | null }) {
  return {
    id: item.id ?? null,
    name: item.name ?? "",
    description: normalizeTextValue(item.description),
    quantity: parseFloat(item.quantity?.toString() ?? "0") || 0,
    unit: item.unit ?? "",
    unit_price: parseFloat(item.unit_price?.toString() ?? "0") || 0,
    category: item.category ?? "other",
    sort_order: Number(item.sort_order ?? 0),
    isNew: Boolean(item.isNew),
  };
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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unit_price) || 0;
  const lineTotal = qty * price;
  const hasLongDescription = item.description.trim().length > 180;

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
    <div className="p-3 border border-border rounded-lg space-y-2 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
            aria-label={`Drag item ${index + 1}`}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">
              {item.name || `Item ${index + 1}`}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {item.quantity} x ${formatDollar(price)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-semibold">${formatDollar(lineTotal)}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onExpand}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {item.description && (
        <div className="mt-0.5">
          <p
            className={`text-xs text-muted-foreground break-words ${isDescriptionExpanded ? "" : "line-clamp-3"}`}
          >
            {item.description}
          </p>
          {hasLongDescription && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              onClick={() => setIsDescriptionExpanded((current) => !current)}
            >
              {isDescriptionExpanded ? "View less" : "View more"}
            </button>
          )}
        </div>
      )}
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
            aria-label={`Drag item ${index + 1}`}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <QuickEstimateLineItem
            leadId={jobId}
            onApply={(name, quantity, unit, unitPrice, description) => {
              onUpdate("name", name);
              if (quantity.trim().length > 0) {
                onUpdate("quantity", quantity);
              }
              onUpdate("unit", unit);
              onUpdate("unit_price", unitPrice);
              if (description.trim().length > 0) {
                onUpdate("description", description);
              }
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

export function EditEstimateModal({ open, onOpenChange, estimate, versionId = null, onSuccess }: EditEstimateModalProps) {
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, LineItemForm>>({});
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<Set<number>>(new Set());
  const isVersionMode = Boolean(versionId);
  const [profitMargin, setProfitMargin] = useState<string>(() => {
    return (estimate.profit_margin || 0).toString();
  });
  const [surcharge, setSurcharge] = useState<string>(() => {
    return (estimate.surcharge || 0).toString();
  });
  const effectiveEstimateLineItems = useMemo(() => {
    if (isVersionMode) {
      return (estimate.line_items || [])
        .map((item: any, index: number) => ({
          id: item.id || `version-item-${index}`,
          name: item.name || "",
          description: item.description || "",
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "each",
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          sort_order: Number(item.sort_order ?? index),
          category: item.category || "other",
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
        }))
        .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    }

    const nonDeletedItems = estimate.line_items.filter(
      (item: any) => item.change_order_type !== 'deleted'
    );

    const approvedEditedOriginalIds = new Set(
      nonDeletedItems
        .filter(
          (item: any) =>
            item.is_change_order &&
            item.change_order_type === 'edited' &&
            item.change_order_approved === true &&
            item.original_line_item_id
        )
        .map((item: any) => item.original_line_item_id)
    );

    const hasApprovalMetadata = nonDeletedItems.some(
      (item: any) => item.change_order_approved !== undefined
    );

    return nonDeletedItems
      .filter((item: any) => {
        if (!item.is_change_order) {
          return !approvedEditedOriginalIds.has(item.id);
        }

        if (!hasApprovalMetadata) {
          return true;
        }

        return item.change_order_approved === true || item.change_order_approved === false;
      })
      .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }, [estimate.line_items, isVersionMode]);

  const buildLineItemsFromEstimate = () => {
    return effectiveEstimateLineItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      quantity: item.quantity.toString(),
      unit: item.unit,
      unit_price: item.unit_price.toString(),
      category: item.category || 'other',
    }));
  };

  const [lineItems, setLineItems] = useState<LineItemForm[]>(buildLineItemsFromEstimate);

  useEffect(() => {
    if (!open) return;

    setLineItems(buildLineItemsFromEstimate());
    setPendingDeleteIndices(new Set());
    setSnapshots({});
    setExpandedIndex(null);
    setDragIndex(null);
    setProfitMargin((estimate.profit_margin || 0).toString());
    setSurcharge((estimate.surcharge || 0).toString());
  }, [open, effectiveEstimateLineItems, estimate.profit_margin, estimate.surcharge]);

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
    setLineItems((previous) => {
      const updated = [...previous];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const reorderLineItems = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= lineItems.length || toIndex >= lineItems.length) {
      return;
    }

    setLineItems((previous) => {
      const updated = [...previous];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });

    setPendingDeleteIndices((previous) => {
      const next = new Set<number>();
      previous.forEach((pendingIndex) => {
        if (pendingIndex === fromIndex) {
          next.add(toIndex);
        } else if (fromIndex < toIndex && pendingIndex > fromIndex && pendingIndex <= toIndex) {
          next.add(pendingIndex - 1);
        } else if (fromIndex > toIndex && pendingIndex >= toIndex && pendingIndex < fromIndex) {
          next.add(pendingIndex + 1);
        } else {
          next.add(pendingIndex);
        }
      });
      return next;
    });

    setSnapshots((previous) => {
      const remapped: Record<number, LineItemForm> = {};
      Object.entries(previous).forEach(([key, value]) => {
        const snapshotIndex = Number(key);
        if (snapshotIndex === fromIndex) {
          remapped[toIndex] = value;
        } else if (fromIndex < toIndex && snapshotIndex > fromIndex && snapshotIndex <= toIndex) {
          remapped[snapshotIndex - 1] = value;
        } else if (fromIndex > toIndex && snapshotIndex >= toIndex && snapshotIndex < fromIndex) {
          remapped[snapshotIndex + 1] = value;
        } else {
          remapped[snapshotIndex] = value;
        }
      });
      return remapped;
    });

    setExpandedIndex((previous) => {
      if (previous === null) return previous;
      if (previous === fromIndex) return toIndex;
      if (fromIndex < toIndex && previous > fromIndex && previous <= toIndex) return previous - 1;
      if (fromIndex > toIndex && previous >= toIndex && previous < fromIndex) return previous + 1;
      return previous;
    });
  };


  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    reorderLineItems(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
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

  const changeSummary = useMemo(() => {
    const existingItems = effectiveEstimateLineItems;

    const currentItemsById = new Map(
      activeLineItems
        .filter((item) => item.id)
        .map((item) => [item.id as string, item])
    );

    let hasAnyChanges = false;
    let hasSubstantiveChanges = false;
    let hasSortOnlyChanges = false;

    for (const originalItem of existingItems) {
      const currentItem = currentItemsById.get(originalItem.id);

      if (!currentItem) {
        hasAnyChanges = true;
        hasSubstantiveChanges = true;
        continue;
      }

      const normalizedOriginal = normalizeLineItemForComparison({
        id: originalItem.id,
        name: originalItem.name,
        description: originalItem.description,
        quantity: originalItem.quantity?.toString(),
        unit: originalItem.unit,
        unit_price: originalItem.unit_price?.toString(),
        category: originalItem.category || 'other',
        sort_order: originalItem.sort_order,
      });
      const normalizedCurrent = normalizeLineItemForComparison({
        ...currentItem,
        sort_order: activeLineItems.findIndex((item) => item === currentItem),
      });

      const hasSubstantiveItemChanges =
        normalizedOriginal.name !== normalizedCurrent.name ||
        normalizedOriginal.description !== normalizedCurrent.description ||
        normalizedOriginal.quantity !== normalizedCurrent.quantity ||
        normalizedOriginal.unit !== normalizedCurrent.unit ||
        normalizedOriginal.unit_price !== normalizedCurrent.unit_price ||
        normalizedOriginal.category !== normalizedCurrent.category;

      const hasSortOrderChange = normalizedOriginal.sort_order !== normalizedCurrent.sort_order;

      if (hasSubstantiveItemChanges || hasSortOrderChange) {
        hasAnyChanges = true;
      }

      if (hasSubstantiveItemChanges) {
        hasSubstantiveChanges = true;
      } else if (hasSortOrderChange) {
        hasSortOnlyChanges = true;
      }
    }

    if (activeLineItems.some((item) => item.isNew)) {
      hasAnyChanges = true;
      hasSubstantiveChanges = true;
    }

    const originalProfitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
    const currentProfitMargin = parseFloat(profitMargin || '0');
    const originalSurcharge = parseFloat(estimate.surcharge?.toString() || '0');
    const currentSurcharge = parseFloat(surcharge || '0');

    if (originalProfitMargin !== currentProfitMargin || originalSurcharge !== currentSurcharge) {
      hasAnyChanges = true;
      hasSubstantiveChanges = true;
    }

    return {
      hasAnyChanges,
      hasSubstantiveChanges,
      hasSortOnlyChanges: hasSortOnlyChanges && !hasSubstantiveChanges,
    };
  }, [activeLineItems, effectiveEstimateLineItems, estimate.profit_margin, estimate.surcharge, profitMargin, surcharge]);

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

      if (isVersionMode && versionId) {
        const normalizedLineItems = activeLineItems
          .map((item, index) => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const total = quantity * unitPrice;
            return {
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: index,
              category: item.category || "other",
            };
          })
          .filter((item) => item.name?.trim().length > 0);

        const subtotal = normalizedLineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const profitMarginValue = parseFloat(profitMargin || "0");
        const surchargeValue = parseFloat(surcharge || "0");
        const profitAmount = subtotal * (profitMarginValue / 100);
        const surchargeAmount = subtotal * (surchargeValue / 100);
        const subtotalWithAdjustments = subtotal + profitAmount + surchargeAmount;
        const taxRate = parseFloat(estimate.tax_rate?.toString() || "0");
        const tax = subtotalWithAdjustments * taxRate;
        const discount = parseFloat(estimate.discount?.toString() || "0");
        const total = subtotalWithAdjustments + tax - discount;

        const { error } = await supabase
          .from("estimate_versions")
          .update({
            line_items: normalizedLineItems,
            subtotal,
            tax_rate: taxRate,
            tax,
            discount,
            total,
            profit_margin: profitMarginValue,
            surcharge: surchargeValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", versionId);

        if (error) throw error;

        toast.success("Version updated successfully");
        onSuccess();
        onOpenChange(false);
        return;
      }

      const shouldTrackChanges = estimate.status === 'accepted';

      const existingIds = new Set(
        effectiveEstimateLineItems.map((item: any) => item.id)
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
        const sortOrder = lineItems.findIndex((lineItem) => lineItem === item);

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
              sort_order: sortOrder,
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
              sort_order: sortOrder,
              category: item.category,
              is_change_order: false,
            });

            if (error) throw error;
          }
        } else if (item.id) {
          const original = effectiveEstimateLineItems.find((li: any) => li.id === item.id);

          const hasSubstantiveChanges =
            original &&
            (original.name !== item.name ||
              normalizeTextValue(original.description) !== normalizeTextValue(item.description) ||
              parseFloat(original.quantity) !== quantity ||
              original.unit !== item.unit ||
              parseFloat(original.unit_price) !== unitPrice ||
              (original.category || 'other') !== item.category);

          const hasSortOrderChange =
            original && Number(original.sort_order ?? 0) !== sortOrder;

          if (hasSubstantiveChanges) {
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
                sort_order: sortOrder,
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
                sort_order: sortOrder,
              }).eq('id', item.id);

              if (error) throw error;
            }
          } else if (hasSortOrderChange) {
            const { error } = await supabase.from('estimate_line_items').update({
              sort_order: sortOrder,
            }).eq('id', item.id);

            if (error) throw error;
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

      if (shouldTrackChanges && changeSummary.hasSubstantiveChanges) {
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
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDragEnd={handleDragEnd}
                  className={dragIndex === index ? "opacity-50" : undefined}
                >
                <ExpandedLineItem
                  item={item}
                  index={index}
                  jobId={estimate.job_id}
                  onUpdate={(field, value) => updateLineItem(index, field, value)}
                  onCollapse={() => setExpandedIndex(null)}
                  onRevert={() => revertLineItem(index)}
                  onRemove={() => markForDelete(index)}
                />
                </div>
              ) : (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDragEnd={handleDragEnd}
                  className={dragIndex === index ? "opacity-50" : undefined}
                >
                <CompactLineItem
                  item={item}
                  index={index}
                  pendingDelete={pendingDeleteIndices.has(index)}
                  onExpand={() => expandLineItem(index)}
                  onRemove={() => markForDelete(index)}
                  onUndoRemove={() => undoDelete(index)}
                />
                </div>
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
            disabled={saving || !changeSummary.hasAnyChanges}
          >
            {saving
              ? "Saving..."
              : estimate.status === 'accepted'
                ? changeSummary.hasSubstantiveChanges
                  ? 'Send Change Order'
                  : 'Save Changes'
                : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
