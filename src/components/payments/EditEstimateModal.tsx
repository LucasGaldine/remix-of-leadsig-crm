import { useState, useEffect, useMemo } from "react";
import type { DragEvent } from "react";
import { GripVertical, Plus, X, Check, Pencil, RotateCcw, Trash2, Undo2, BookmarkPlus, Mic } from "lucide-react";
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
import { QuickAddLineItem } from "@/components/leads/QuickAddLineItem";
import {
  getLineItemTemplates,
  migrateLegacyTemplatesToDatabase,
  upsertDedupedLineItemTemplate,
  type LineItemTemplate,
} from "@/lib/lineItemTemplates";
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
  versionName?: string | null;
  showVersionNameField?: boolean;
  onVersionNameChange?: (name: string) => void;
  showVoiceEstimateIntakeButton?: boolean;
  onVoiceEstimateIntakeClick?: () => void;
  onSuccess: () => void;
  embedded?: boolean;
  onDraftSave?: (payload: {
    lineItems: Array<{
      name: string;
      description: string;
      quantity: string;
      unit: string;
      unit_price: string;
      category: LineItemCategory;
    }>;
    profitMargin: string;
    surcharge: string;
    profitMode?: "percentage" | "amount";
    profitAmount?: string;
  }) => void;
  onDraftChange?: (payload: {
    lineItems: Array<{
      name: string;
      description: string;
      quantity: string;
      unit: string;
      unit_price: string;
      category: LineItemCategory;
    }>;
    profitMargin: string;
    surcharge: string;
    profitMode?: "percentage" | "amount";
    profitAmount?: string;
  }) => void;
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
  templates,
  onUpdate,
  onCollapse,
  onRevert,
  onRemove,
  onSaveTemplate,
}: {
  item: LineItemForm;
  index: number;
  templates: LineItemTemplate[];
  onUpdate: (field: keyof LineItemForm, value: string) => void;
  onCollapse: () => void;
  onRevert: () => void;
  onRemove: () => void;
  onSaveTemplate: () => void;
}) {
  const [priceDisplay, setPriceDisplay] = useState(
    item.unit_price ? formatDollar(parseFloat(item.unit_price)) : ""
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unit_price) || 0;
  const lineTotal = qty * price;
  const normalizedTitleQuery = item.name.trim().toLowerCase();

  const matchingTemplates = useMemo(() => {
    if (!normalizedTitleQuery) return [];
    return templates
      .filter((template) => template.name.trim().toLowerCase().includes(normalizedTitleQuery))
      .slice(0, 3);
  }, [templates, normalizedTitleQuery]);

  const applyTemplateToLineItem = (template: LineItemTemplate) => {
    onUpdate("name", template.name);
    if (template.quantity.trim().length > 0) {
      onUpdate("quantity", template.quantity);
    }
    if (template.unit.trim().length > 0) {
      onUpdate("unit", template.unit);
    }
    onUpdate("unit_price", template.unit_price);
    if (template.description.trim().length > 0) {
      onUpdate("description", template.description);
    }
    if (template.category.trim().length > 0) {
      onUpdate("category", template.category);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      setPriceDisplay(item.unit_price ? formatDollar(parseFloat(item.unit_price)) : "");
    }
  }, [item.unit_price, isFocused]);

  return (
    <div className="p-4 border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs text-muted-foreground" onClick={onSaveTemplate}>
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save as template
        </Button>
        <div className="flex items-center gap-1">
          <QuickAddLineItem
            templates={templates}
            onApply={applyTemplateToLineItem}
          />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-item-name-${index}`}>Title *</Label>
        <div className="relative">
          <Input
            id={`edit-item-name-${index}`}
            value={item.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => setIsTitleFocused(false)}
            placeholder="e.g., Paver Installation"
          />
          {isTitleFocused && normalizedTitleQuery.length > 0 ? (
            matchingTemplates.length > 0 ? (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 border border-border rounded-md bg-background p-1 space-y-1 shadow-md">
                {matchingTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyTemplateToLineItem(template);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent transition-colors"
                  >
                    <div className="text-sm font-medium">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ${formatDollar(parseFloat(template.unit_price || "0"))} / {template.unit || "each"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 border border-border rounded-md bg-background p-2 shadow-md">
                <p className="text-xs text-muted-foreground">
                  No template match. Click <span className="font-medium text-foreground">Save as template</span> to reuse this item later.
                </p>
              </div>
            )
          ) : null}
        </div>
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

export function EditEstimateModal({
  open,
  onOpenChange,
  estimate,
  versionId = null,
  versionName = null,
  showVersionNameField = false,
  onVersionNameChange,
  showVoiceEstimateIntakeButton = false,
  onVoiceEstimateIntakeClick,
  onSuccess,
  embedded = false,
  onDraftSave,
  onDraftChange,
}: EditEstimateModalProps) {
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, LineItemForm>>({});
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<Set<number>>(new Set());
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const isVersionMode = Boolean(versionId);
  const shouldShowVersionNameField = isVersionMode || showVersionNameField;
  const [versionNameDraft, setVersionNameDraft] = useState<string>(() => (versionName || "").trim());
  const [profitMargin, setProfitMargin] = useState<string>(() => {
    return (estimate.profit_margin || 0).toString();
  });
  const [profitMode, setProfitMode] = useState<"percentage" | "amount">("percentage");
  const [profitAmount, setProfitAmount] = useState<string>(() => {
    const subtotal = Number(estimate.subtotal || 0);
    const marginPercent = Number(estimate.profit_margin || 0);
    return (subtotal * (marginPercent / 100)).toFixed(2);
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

  const initializeEditorState = () => {
    const currentSubtotal = Number(estimate.subtotal || 0);
    const currentMarginPercent = Number(estimate.profit_margin || 0);
    setLineItems(buildLineItemsFromEstimate());
    setPendingDeleteIndices(new Set());
    setSnapshots({});
    setExpandedIndex(null);
    setDragIndex(null);
    setVersionNameDraft((versionName || "").trim());
    setProfitMargin((estimate.profit_margin || 0).toString());
    setProfitMode("percentage");
    setProfitAmount((currentSubtotal * (currentMarginPercent / 100)).toFixed(2));
    setSurcharge((estimate.surcharge || 0).toString());
  };

  const loadTemplates = async (isCancelledRef: { value: boolean }) => {
    if (!estimate.account_id) {
      if (!isCancelledRef.value) {
        setLineItemTemplates([]);
      }
      return;
    }

    await migrateLegacyTemplatesToDatabase(estimate.account_id);
    const templates = await getLineItemTemplates(estimate.account_id);
    if (!isCancelledRef.value) {
      setLineItemTemplates(templates);
    }
  };

  useEffect(() => {
    if (!open || !embedded) return;
    const isCancelledRef = { value: false };
    initializeEditorState();
    void loadTemplates(isCancelledRef);
    return () => {
      isCancelledRef.value = true;
    };
  }, [open, embedded]);

  useEffect(() => {
    if (!open || embedded) return;
    const isCancelledRef = { value: false };
    initializeEditorState();
    void loadTemplates(isCancelledRef);
    return () => {
      isCancelledRef.value = true;
    };
  }, [open, embedded, effectiveEstimateLineItems, estimate.account_id, estimate.profit_margin, estimate.surcharge]);

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

  const saveLineItemAsTemplate = async (index: number) => {
    const item = lineItems[index];
    if (!item || item.name.trim().length === 0) {
      toast.error("Add a title before saving as a template");
      return;
    }

    if (!estimate.account_id) {
      toast.error("Missing account for template save");
      return;
    }

    const saved = await upsertDedupedLineItemTemplate(
      estimate.account_id,
      {
        name: item.name.trim(),
        description: item.description || "",
        quantity: item.quantity || "1",
        unit: item.unit || "each",
        unit_price: item.unit_price || "0",
        category: item.category || "other",
      },
      lineItemTemplates,
    );

    if (!saved) {
      toast.error("Failed to save template");
      return;
    }

    const refreshed = await getLineItemTemplates(estimate.account_id);
    setLineItemTemplates(refreshed);
    toast.success("Template saved");
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
  const normalizedVersionName = (versionName || "").trim();
  const normalizedVersionNameDraft = versionNameDraft.trim();

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
    const currentSubtotal = activeLineItems.reduce(
      (sum, item) => sum + calculateLineItemTotal(item.quantity, item.unit_price),
      0,
    );
    const currentProfitAmount = profitMode === "amount"
      ? (parseFloat(profitAmount || "0") || 0)
      : currentSubtotal * ((parseFloat(profitMargin || "0") || 0) / 100);
    const currentProfitMargin = currentSubtotal > 0 ? (currentProfitAmount / currentSubtotal) * 100 : 0;
    const originalSurcharge = parseFloat(estimate.surcharge?.toString() || '0');
    const currentSurcharge = parseFloat(surcharge || '0');

    if (originalProfitMargin !== currentProfitMargin || originalSurcharge !== currentSurcharge) {
      hasAnyChanges = true;
      hasSubstantiveChanges = true;
    }

    if (shouldShowVersionNameField && normalizedVersionNameDraft !== normalizedVersionName) {
      hasAnyChanges = true;
      hasSubstantiveChanges = true;
    }

    return {
      hasAnyChanges,
      hasSubstantiveChanges,
      hasSortOnlyChanges: hasSortOnlyChanges && !hasSubstantiveChanges,
    };
  }, [
    activeLineItems,
    effectiveEstimateLineItems,
    estimate.profit_margin,
    estimate.surcharge,
    isVersionMode,
    normalizedVersionName,
    normalizedVersionNameDraft,
    shouldShowVersionNameField,
    profitMargin,
    profitMode,
    profitAmount,
    surcharge,
  ]);

  const calculateTotals = () => {
    const subtotal = activeLineItems.reduce((sum, item) => {
      return sum + calculateLineItemTotal(item.quantity, item.unit_price);
    }, 0);
    const parsedProfitAmount = parseFloat(profitAmount || "0");
    const effectiveProfitAmount =
      profitMode === "amount"
        ? (Number.isFinite(parsedProfitAmount) ? parsedProfitAmount : 0)
        : subtotal * (parseFloat(profitMargin || "0") / 100);
    const effectiveProfitMarginPercent = subtotal > 0 ? (effectiveProfitAmount / subtotal) * 100 : 0;
    const surchargeValue = parseFloat(surcharge || '0') / 100;
    const surchargeAmount = subtotal * surchargeValue;
    const subtotalWithAdjustments = subtotal + effectiveProfitAmount + surchargeAmount;
    const taxAmount = subtotalWithAdjustments * parseFloat(estimate.tax_rate.toString());
    const discountAmount = parseFloat(estimate.discount.toString());
    const total = subtotalWithAdjustments + taxAmount - discountAmount;

    return {
      subtotal,
      profitAmount: effectiveProfitAmount,
      profitMarginPercent: effectiveProfitMarginPercent,
      surchargeAmount,
      taxAmount,
      discountAmount,
      total,
    };
  };

  const saveChanges = async () => {
    if (activeLineItems.length === 0 || activeLineItems.every(item => !item.name)) {
      toast.error("Please add at least one line item with a name");
      return;
    }

    try {
      setSaving(true);

      if (onDraftSave) {
        const normalizedLineItems = activeLineItems
          .map((item) => ({
            name: item.name.trim(),
            description: item.description || "",
            quantity: item.quantity || "1",
            unit: item.unit || "item",
            unit_price: item.unit_price || "0",
            category: item.category || "other",
          }))
          .filter((item) => item.name.length > 0);

        onDraftSave({
          lineItems: normalizedLineItems,
          profitMargin: profitMarginPercent.toString(),
          surcharge,
          profitMode,
          profitAmount: calculatedProfitAmount.toString(),
        });
        onOpenChange(false);
        return;
      }

      if (isVersionMode && versionId) {
        if (!normalizedVersionNameDraft) {
          toast.error("Version name is required");
          return;
        }

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
        const profitMarginValue = profitMarginPercent;
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
            name: normalizedVersionNameDraft,
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
      let createdPendingChangeOrder = false;

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
          createdPendingChangeOrder = true;
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
            createdPendingChangeOrder = true;
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
              createdPendingChangeOrder = true;
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

      let estimateUpdateValues: Record<string, unknown> | null = null;

      if (activeItems && activeItems.length > 0) {
        const newSubtotal = activeItems.reduce(
          (sum, item) => sum + parseFloat(item.total.toString()),
          0
        );
        const profitMarginValue = profitMarginPercent / 100;
        const profitAmount = newSubtotal * profitMarginValue;
        const surchargeValue = parseFloat(surcharge || '0') / 100;
        const surchargeAmount = newSubtotal * surchargeValue;
        const subtotalWithAdjustments = newSubtotal + profitAmount + surchargeAmount;
        const newTax = subtotalWithAdjustments * parseFloat(estimate.tax_rate.toString());
        const newTotal = subtotalWithAdjustments + newTax - parseFloat(estimate.discount.toString());

        estimateUpdateValues = {
          subtotal: newSubtotal,
          profit_margin: profitMarginPercent,
          surcharge: parseFloat(surcharge || '0'),
          tax: newTax,
          total: newTotal,
          updated_at: new Date().toISOString(),
        };
      }

      if (shouldTrackChanges && createdPendingChangeOrder) {
        estimateUpdateValues = {
          ...(estimateUpdateValues || { updated_at: new Date().toISOString() }),
          has_pending_changes: true,
        };
      }

      if (estimateUpdateValues) {
        await supabase
          .from('estimates')
          .update(estimateUpdateValues)
          .eq('id', estimate.id);
      }

      if (shouldTrackChanges && createdPendingChangeOrder) {
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

  const {
    subtotal,
    profitAmount: calculatedProfitAmount,
    profitMarginPercent,
    surchargeAmount,
    taxAmount,
    discountAmount,
    total,
  } = calculateTotals();

  useEffect(() => {
    if (!onDraftChange) return;
    const normalizedLineItems = activeLineItems
      .map((item) => ({
        name: item.name.trim(),
        description: item.description || "",
        quantity: item.quantity || "1",
        unit: item.unit || "item",
        unit_price: item.unit_price || "0",
        category: item.category || "other",
      }))
      .filter((item) => item.name.length > 0);

    onDraftChange({
      lineItems: normalizedLineItems,
      profitMargin: profitMarginPercent.toString(),
      surcharge,
      profitMode,
      profitAmount: calculatedProfitAmount.toString(),
    });
  }, [activeLineItems, onDraftChange, profitMarginPercent, surcharge, profitMode, calculatedProfitAmount]);

  const editorBody = (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        {shouldShowVersionNameField ? (
          <div className="space-y-2">
            <Label htmlFor="estimate-version-name">Version Name *</Label>
            <Input
              id="estimate-version-name"
              value={versionNameDraft}
              onChange={(event) => {
                const nextValue = event.target.value;
                setVersionNameDraft(nextValue);
                onVersionNameChange?.(nextValue);
              }}
              placeholder="Version name"
            />
          </div>
        ) : null}

        {showVoiceEstimateIntakeButton ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onVoiceEstimateIntakeClick}
          >
            <Mic className="h-4 w-4 mr-2" />
            Voice Estimate Intake
          </Button>
        ) : null}

        {!embedded ? <Label className="text-base font-semibold">Line Items *</Label> : null}

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
              templates={lineItemTemplates}
              onUpdate={(field, value) => updateLineItem(index, field, value)}
              onCollapse={() => setExpandedIndex(null)}
              onRevert={() => revertLineItem(index)}
              onRemove={() => markForDelete(index)}
              onSaveTemplate={() => saveLineItemAsTemplate(index)}
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
              <span className="text-muted-foreground">Profit:</span>
              <div className="flex items-center gap-2">
                {profitMode === "percentage" ? (
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={profitMargin}
                      onChange={(e) => setProfitMargin(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                ) : (
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={profitAmount}
                      onChange={(e) => setProfitAmount(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
                <Select
                  value={profitMode}
                  onValueChange={(value) => {
                    const nextMode = value as "percentage" | "amount";
                    if (nextMode === profitMode) return;
                    if (nextMode === "amount") {
                      setProfitAmount(calculatedProfitAmount.toFixed(2));
                    } else if (subtotal > 0) {
                      const nextPercent = (calculatedProfitAmount / subtotal) * 100;
                      setProfitMargin(nextPercent.toFixed(2));
                    } else {
                      setProfitMargin("0");
                    }
                    setProfitMode(nextMode);
                  }}
                >
                  <SelectTrigger className="h-7 w-[64px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="amount">$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <span className="font-medium">
              ${calculatedProfitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  );

  if (embedded) {
    return editorBody;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100dvw-1rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Estimate</DialogTitle>
          <DialogDescription>
            Update line items for this estimate. The total will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        {editorBody}

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
