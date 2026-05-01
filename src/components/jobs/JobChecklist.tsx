import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Trash2,
  Copy,
  Check,
  Wrench,
  Package,
  ClipboardList,
  Save,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useJobChecklist,
  ChecklistItem,
  ChecklistItemCategory,
  getChecklistItemCategory,
} from "@/hooks/useJobChecklist";
import { useJobLineItems, JobLineItem } from "@/hooks/useJobLineItems";
import { useAuth } from "@/hooks/useAuth";
import {
  getLineItemTemplates,
  LineItemTemplate,
  migrateLegacyTemplatesToDatabase,
} from "@/lib/lineItemTemplates";
import {
  DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL,
  SEND_CLIENT_PORTAL_CHECKLIST_LABEL,
  isReviewRequestChecklistItem,
  shouldUsePortalFallback,
} from "@/lib/jobCompletionReview";
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
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface JobChecklistProps {
  jobId: string;
  jobStatus?: string;
  isEstimateVisit?: boolean;
  clientPortalUrl?: string | null;
  customerPhone?: string | null;
  isTwilioConfigured?: boolean;
  isManager?: boolean;
  onMarkComplete?: () => Promise<void> | void;
  hasBeforePhotos?: boolean;
  embedded?: boolean;
  onGoToDetailsTab?: () => void;
  scanReceiptSignal?: number;
}

type ChecklistEditorMode = "add" | "edit";

interface ChecklistEditorState {
  open: boolean;
  mode: ChecklistEditorMode;
  itemId: string | null;
  jobLineItemId: string | null;
  label: string;
  category: Exclude<ChecklistItemCategory, "standard">;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

const MATERIAL_UNIT_OPTIONS = [
  { value: "item", label: "Item" },
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "sq ft", label: "Sq Ft" },
  { value: "linear ft", label: "Linear Ft" },
  { value: "day", label: "Day" },
] as const;

const DEFAULT_MATERIAL_UNIT = "each";
const isSupportedMaterialUnit = (unit: string) =>
  MATERIAL_UNIT_OPTIONS.some((option) => option.value === unit);
const normalizeMaterialUnit = (unit?: string | null) =>
  unit && isSupportedMaterialUnit(unit) ? unit : DEFAULT_MATERIAL_UNIT;

const DEFAULT_EDITOR_STATE: ChecklistEditorState = {
  open: false,
  mode: "add",
  itemId: null,
  jobLineItemId: null,
  label: "",
  category: "task",
  description: "",
  quantity: "1",
  unit: DEFAULT_MATERIAL_UNIT,
  unit_price: "0",
};

export function JobChecklist({
  jobId,
  jobStatus,
  isEstimateVisit,
  clientPortalUrl,
  customerPhone,
  isTwilioConfigured = false,
  isManager = false,
  onMarkComplete,
  hasBeforePhotos = false,
  embedded = false,
  onGoToDetailsTab,
  scanReceiptSignal = 0,
}: JobChecklistProps) {
  const { items, isLoading, toggleItem, addItem, updateItem, deleteItem } =
    useJobChecklist(jobId);
  const { lineItems, addLineItem, updateLineItem, deleteLineItem } = useJobLineItems(jobId);
  const { currentAccount } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<ChecklistEditorState>(DEFAULT_EDITOR_STATE);
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const [isMaterialNameFocused, setIsMaterialNameFocused] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [touchDraggingTaskId, setTouchDraggingTaskId] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const getDisplayCategory = (
    item: ChecklistItem,
  ): Exclude<ChecklistItemCategory, "standard"> => {
    const category = getChecklistItemCategory(item.metadata);
    return category === "standard" ? "task" : category;
  };

  const materialChecklistByLineItemId = useMemo(() => {
    const map = new Map<string, ChecklistItem>();
    items
      .filter((item) => getDisplayCategory(item) === "material")
      .forEach((item) => {
        const linkedLineItemId =
          item.metadata &&
          typeof item.metadata === "object" &&
          "job_line_item_id" in item.metadata &&
          typeof item.metadata.job_line_item_id === "string"
            ? item.metadata.job_line_item_id
            : null;

        if (linkedLineItemId) {
          map.set(linkedLineItemId, item);
        }
      });
    return map;
  }, [items]);

  const materialChecklistFallbackByName = useMemo(() => {
    const map = new Map<string, ChecklistItem>();
    items
      .filter((item) => getDisplayCategory(item) === "material")
      .forEach((item) => {
        const hasLink =
          item.metadata &&
          typeof item.metadata === "object" &&
          "job_line_item_id" in item.metadata &&
          typeof item.metadata.job_line_item_id === "string";
        if (!hasLink) {
          map.set(item.label.trim().toLowerCase(), item);
        }
      });
    return map;
  }, [items]);

  const isJobCompleted = jobStatus === "completed" || jobStatus === "paid";
  const checklistProgressItems = items.filter((item) => getDisplayCategory(item) !== "material");
  const materialProgress = lineItems
    .filter((item) => item.category === "materials")
    .map((lineItem) => {
      const linked =
        materialChecklistByLineItemId.get(lineItem.id) ||
        materialChecklistFallbackByName.get(lineItem.name.trim().toLowerCase()) ||
        null;
      return isJobCompleted ? true : linked?.is_completed ?? false;
    });
  const completedCount =
    checklistProgressItems.filter((i) => (isJobCompleted ? true : i.is_completed)).length +
    materialProgress.filter(Boolean).length;
  const totalCount = checklistProgressItems.length + materialProgress.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const hasReviewRequestItem = items.some((item) => isReviewRequestChecklistItem(item.label));
  const shouldShowPortalCopyHint = shouldUsePortalFallback(isTwilioConfigured, customerPhone);
  const categoryOptions: { value: Exclude<ChecklistItemCategory, "standard">; label: string }[] = [
    { value: "task", label: "Task" },
    { value: "tool", label: "Tool" },
    { value: "material", label: "Material" },
  ];

  const buildMetadataFromCategory = (category: ChecklistItemCategory) =>
    category === "standard" ? null : { category };

  const sectionItems = useMemo(
    () => ({
      task: items.filter((item) => getDisplayCategory(item) === "task"),
      tool: items.filter((item) => getDisplayCategory(item) === "tool"),
      material: lineItems.filter((item) => item.category === "materials"),
    }),
    [items, lineItems],
  );

  const checklistSections: {
    category: Exclude<ChecklistItemCategory, "standard">;
    title: string;
    addLabel: string;
    icon: typeof ClipboardList;
  }[] = [
    { category: "task", title: "Tasks", addLabel: "Add Task", icon: ClipboardList },
    { category: "tool", title: "Tools", addLabel: "Add Tool", icon: Wrench },
    { category: "material", title: "Materials", addLabel: "Add Material", icon: Package },
  ];

  const emptySectionCopy: Record<
    Exclude<ChecklistItemCategory, "standard">,
    { title: string; description: string }
  > = {
    task: {
      title: "No tasks yet",
      description: "Add tasks to track what needs to get done on this job.",
    },
    tool: {
      title: "No tools yet",
      description: "Add tools to track what you use on this job.",
    },
    material: {
      title: "No materials yet",
      description: "Add materials to track what you use on this job.",
    },
  };

  useEffect(() => {
    if (!editor.open || editor.category !== "material" || !currentAccount?.id) return;
    let isCancelled = false;

    const loadTemplates = async () => {
      await migrateLegacyTemplatesToDatabase(currentAccount.id);
      const templates = await getLineItemTemplates(currentAccount.id);
      if (!isCancelled) {
        setLineItemTemplates(templates);
      }
    };

    void loadTemplates();
    return () => {
      isCancelled = true;
    };
  }, [currentAccount?.id, editor.open, editor.category]);

  const resetEditor = () => setEditor(DEFAULT_EDITOR_STATE);

  const openAddDialog = (category: Exclude<ChecklistItemCategory, "standard"> = "task") => {
    setEditor({
      open: true,
      mode: "add",
      itemId: null,
      jobLineItemId: null,
      label: "",
      category,
      description: "",
      quantity: "1",
      unit: DEFAULT_MATERIAL_UNIT,
      unit_price: "0",
    });
  };

  const openEditDialog = (item: ChecklistItem) => {
    setEditor({
      open: true,
      mode: "edit",
      itemId: item.id,
      jobLineItemId: null,
      label: item.label,
      category: getDisplayCategory(item),
      description: "",
      quantity: "1",
      unit: DEFAULT_MATERIAL_UNIT,
      unit_price: "0",
    });
  };

  const openEditMaterialDialog = (item: JobLineItem) => {
    setEditor({
      open: true,
      mode: "edit",
      itemId: null,
      jobLineItemId: item.id,
      label: item.name,
      category: "material",
      description: item.description || "",
      quantity: String(item.quantity),
      unit: normalizeMaterialUnit(item.unit),
      unit_price: String(item.unit_price),
    });
  };

  const getMaterialChecklistItem = (lineItem: JobLineItem): ChecklistItem | null =>
    materialChecklistByLineItemId.get(lineItem.id) ||
    materialChecklistFallbackByName.get(lineItem.name.trim().toLowerCase()) ||
    null;

  const handleToggle = async (item: ChecklistItem) => {
    if (editMode || isJobCompleted) return;

    try {
      await toggleItem.mutateAsync({
        id: item.id,
        is_completed: !item.is_completed,
      });
    } catch {
      toast.error("Failed to update checklist item");
    }
  };

  const handleCompleteClick = () => {
    if (editMode || isJobCompleted) return;
    if (isEstimateVisit && !hasBeforePhotos) {
      toast.error("Before photos must be uploaded before marking this job as complete");
      return;
    }
    setCompleteDialogOpen(true);
  };

  const handleConfirmComplete = async () => {
    setMarkingComplete(true);
    try {
      const uncheckedItems = checklistProgressItems.filter((item) => !item.is_completed);
      for (const item of uncheckedItems) {
        await toggleItem.mutateAsync({
          id: item.id,
          is_completed: true,
        });
      }
      if (onMarkComplete) {
        await onMarkComplete();
      }
      toast.success("Job marked as complete");
    } catch {
      toast.error("Failed to complete job");
    } finally {
      setMarkingComplete(false);
      setCompleteDialogOpen(false);
    }
  };

  const handleSaveItem = async () => {
    const label = editor.label.trim();
    if (!label) return;

    try {
      if (editor.category === "material") {
        const quantity = parseFloat(editor.quantity) || 0;
        const unitPrice = parseFloat(editor.unit_price) || 0;
        const total = quantity * unitPrice;

        if (editor.mode === "add") {
          const maxSortOrder = Math.max(0, ...lineItems.map((lineItem) => lineItem.sort_order));
          const insertedLineItem = await addLineItem.mutateAsync({
            lead_id: jobId!,
            name: label,
            description: editor.description.trim() || null,
            quantity,
            unit: normalizeMaterialUnit(editor.unit.trim()),
            unit_price: unitPrice,
            total,
            sort_order: maxSortOrder + 1,
            estimate_line_item_id: null,
            category: "materials",
          });
          await addItem.mutateAsync({
            label,
            sort_order: items.length,
            metadata: { category: "material", job_line_item_id: insertedLineItem.id },
            is_completed: false,
          });
        } else if (editor.jobLineItemId) {
          await updateLineItem.mutateAsync({
            id: editor.jobLineItemId,
            name: label,
            description: editor.description.trim() || null,
            quantity,
            unit: normalizeMaterialUnit(editor.unit.trim()),
            unit_price: unitPrice,
            total,
            category: "materials",
          });
          const linkedChecklistItem = materialChecklistByLineItemId.get(editor.jobLineItemId);
          if (linkedChecklistItem) {
            await updateItem.mutateAsync({
              id: linkedChecklistItem.id,
              label,
              metadata: { category: "material", job_line_item_id: editor.jobLineItemId },
            });
          }
        } else if (editor.itemId) {
          await updateItem.mutateAsync({
            id: editor.itemId,
            label,
            metadata: buildMetadataFromCategory(editor.category),
          });
        }
      } else {
        if (editor.mode === "add") {
          await addItem.mutateAsync({
            label,
            sort_order: items.length,
            metadata: buildMetadataFromCategory(editor.category),
          });
        } else if (editor.itemId) {
          await updateItem.mutateAsync({
            id: editor.itemId,
            label,
            metadata: buildMetadataFromCategory(editor.category),
          });
        }
      }

      resetEditor();
    } catch {
      toast.error(editor.mode === "add" ? "Failed to add checklist item" : "Failed to update item");
    }
  };

  const normalizedMaterialTemplateQuery = editor.label.trim().toLowerCase();
  const matchingMaterialTemplates = useMemo(() => {
    if (!normalizedMaterialTemplateQuery) return [];
    return lineItemTemplates
      .filter((template) => (template.category || "").trim().toLowerCase() === "materials")
      .filter((template) => template.name.trim().toLowerCase().includes(normalizedMaterialTemplateQuery))
      .slice(0, 3);
  }, [lineItemTemplates, normalizedMaterialTemplateQuery]);

  const applyMaterialTemplate = (template: LineItemTemplate) => {
    setEditor((current) => ({
      ...current,
      label: template.name,
      description: template.description.trim().length > 0 ? template.description : current.description,
      quantity: template.quantity.trim().length > 0 ? template.quantity : current.quantity,
      unit: template.unit.trim().length > 0 ? normalizeMaterialUnit(template.unit) : current.unit,
      unit_price: template.unit_price,
    }));
  };

  const handleMaterialToggle = async (lineItem: JobLineItem) => {
    if (editMode || isJobCompleted) return;

    const linkedChecklistItem = getMaterialChecklistItem(lineItem);
    try {
      if (linkedChecklistItem) {
        await toggleItem.mutateAsync({
          id: linkedChecklistItem.id,
          is_completed: !linkedChecklistItem.is_completed,
        });
        return;
      }

      await addItem.mutateAsync({
        label: lineItem.name,
        sort_order: items.length,
        metadata: { category: "material", job_line_item_id: lineItem.id },
        is_completed: true,
      });
    } catch {
      toast.error("Failed to update checklist item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const reorderTaskItems = async (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const taskItems = items
      .filter((item) => getDisplayCategory(item) === "task")
      .sort((a, b) => a.sort_order - b.sort_order);

    const fromIndex = taskItems.findIndex((item) => item.id === fromId);
    const toIndex = taskItems.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...taskItems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    try {
      await Promise.all(
        reordered.map((item, index) =>
          updateItem.mutateAsync({
            id: item.id,
            sort_order: index,
            label: item.label,
            metadata: item.metadata ?? null,
          }),
        ),
      );
    } catch {
      toast.error("Failed to reorder tasks");
    }
  };

  useEffect(() => {
    if (!touchDraggingTaskId) return;

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchDraggingTaskId) return;
      if (!event.touches.length) return;

      // Prevent page scrolling while a task is being dragged.
      event.preventDefault();

      const touch = event.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const taskRow = target?.closest("[data-task-row-id]") as HTMLElement | null;
      if (taskRow?.dataset.taskRowId && taskRow.dataset.taskRowId !== dragOverTaskId) {
        setDragOverTaskId(taskRow.dataset.taskRowId);
      }
    };

    const handleTouchEnd = () => {
      if (touchDraggingTaskId && dragOverTaskId && touchDraggingTaskId !== dragOverTaskId) {
        void reorderTaskItems(touchDraggingTaskId, dragOverTaskId);
      }
      setTouchDraggingTaskId(null);
      setDraggedTaskId(null);
      setDragOverTaskId(null);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [touchDraggingTaskId, dragOverTaskId]);

  const copyPortalLink = async () => {
    if (!clientPortalUrl) return;
    try {
      await navigator.clipboard.writeText(clientPortalUrl);
      setCopiedPortal(true);
      toast.success("Client portal link copied");
      setTimeout(() => setCopiedPortal(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!response.ok) {
        throw new Error("Failed to scan receipt");
      }

      const { lineItems: scannedItems } = await response.json();
      if (!scannedItems || scannedItems.length === 0) {
        toast.warning("No items found in receipt");
        return;
      }

      const maxSortOrder = Math.max(0, ...lineItems.map((lineItem) => lineItem.sort_order));
      for (let i = 0; i < scannedItems.length; i += 1) {
        const scannedItem = scannedItems[i];
        const insertedLineItem = await addLineItem.mutateAsync({
          lead_id: jobId,
          name: scannedItem.name,
          description: scannedItem.description ?? null,
          quantity: scannedItem.quantity,
          unit: scannedItem.unit,
          unit_price: scannedItem.unit_price,
          total: scannedItem.total,
          sort_order: maxSortOrder + i + 1,
          estimate_line_item_id: null,
          category: "materials",
        });

        await addItem.mutateAsync({
          label: scannedItem.name,
          sort_order: items.length + i,
          metadata: { category: "material", job_line_item_id: insertedLineItem.id },
          is_completed: false,
        });
      }

      toast.success(`Added ${scannedItems.length} item${scannedItems.length !== 1 ? "s" : ""} from receipt`);
    } catch (error) {
      console.error("Receipt scan error:", error);
      toast.error("Failed to scan receipt. Please try again.");
    } finally {
      setIsScanningReceipt(false);
      if (receiptInputRef.current) {
        receiptInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (!scanReceiptSignal) return;
    if (isScanningReceipt) return;
    receiptInputRef.current?.click();
  }, [scanReceiptSignal, isScanningReceipt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasMaterialLineItems = lineItems.some((item) => item.category === "materials");

  if (checklistProgressItems.length === 0 && !hasMaterialLineItems && !editMode) {
    return (
      <div className="space-y-3">
        <div className="text-center py-12">
          <Circle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-0">No items</p>
          {isManager && (
            <Button variant="ghost" onClick={() => setEditMode(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task, Tool, or Material
            </Button>
          )}
        </div>
        <div className="my-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleCompleteClick}
            disabled={isJobCompleted || editMode}
          >
            <CheckCircle2 />
            <span className={cn(isJobCompleted && "line-through text-muted-foreground")}>
              Complete
            </span>
          </Button>
        </div>
        <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Job as Complete?</AlertDialogTitle>
              <AlertDialogDescription>
                All checklist items will be checked off. Would you like to mark this job as complete?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
              <AlertDialogCancel size="lg" className="mt-0 flex-1" onClick={() => setCompleteDialogOpen(false)} disabled={markingComplete}>
                No, Keep Open
              </AlertDialogCancel>
              <AlertDialogAction size="lg" className="flex-1" onClick={handleConfirmComplete} disabled={markingComplete}>
                {markingComplete ? "Completing..." : "Yes, Mark Complete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg md:text-sm font-medium text-muted-foreground">
            {completedCount}/{totalCount}
            <span className="hidden md:inline"> complete</span>
          </span>
          {allComplete && (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              All done
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 self-center">
          <div className="h-2.5 md:h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allComplete ? "bg-green-600" : "bg-primary",
              )}
              style={{
                width:
                  totalCount > 0
                    ? completedCount === 0
                      ? "12px"
                      : `${(completedCount / totalCount) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
        {isManager && !isJobCompleted && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-end gap-2",
              "w-auto",
            )}
          >
            {editMode ? (
              <Button
                variant="default"
                size="lg"
                onClick={() => {
                  setEditMode(false);
                  resetEditor();
                }}
              >
                <Save className="h-4 w-4 mr-1" />
                Done
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditMode(true);
                  resetEditor();
                }}
              >
                <div className="text-muted-foreground flex gap-1 justify-center items-center">
                  <Pencil className="h-4 w-4 mr-1" />
                  <span className="text-lg md:text-sm">Edit</span>
                </div>
              </Button>
            )}
          </div>
        )}
      </div>
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleScanReceipt}
      />

      <div
        className={cn(
          "overflow-hidden",
          embedded ? "" : "rounded-lg border border-border bg-card",
        )}
      >
        {checklistSections.map((section, index) => {
          const Icon = section.icon;
          const sectionList = sectionItems[section.category];
          const sectionEmptyCopy = emptySectionCopy[section.category];
          const hasItemsInSection = sectionList.length > 0;

          return (
            <section
              key={section.category}
              aria-label={`${section.title} checklist`}
              className={cn(
                "px-3 md:p-3 space-y-1",
                index === 0 ? "pt-5 pb-3" : "py-3",
              )}
            >
              {hasItemsInSection && (
                <div className="flex items-center gap-2 md:gap-1.5">
                  <Icon className="h-4 w-4 md:h-3 md:w-3 shrink-0 text-muted-foreground" />
                  <h3 className="text-sm md:text-xs uppercase tracking-wide leading-none text-muted-foreground">
                    {section.title}
                  </h3>
                </div>
              )}
              {sectionList.length === 0 && !editMode ? (
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="font-medium leading-tight text-foreground text-base"
                    >
                      {sectionEmptyCopy.title}
                    </p>
                    <p
                      className="text-muted-foreground text-xs"
                    >
                      {sectionEmptyCopy.description}
                    </p>
                  </div>
                </div>
              ) : sectionList.length > 0 ? (
                <div>
                  {sectionList.map((item) => {
                    if (section.category === "material") {
                      const materialItem = item as JobLineItem;
                      const linkedChecklistItem = getMaterialChecklistItem(materialItem);
                      const isMaterialCompleted = isJobCompleted || Boolean(linkedChecklistItem?.is_completed);
                      return (
                        <div
                          key={materialItem.id}
                          className={cn(
                            "flex items-start gap-3 p-3 transition-colors",
                            "hover:bg-muted/40",
                          )}
                        >
                          {!editMode ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 md:h-8 md:w-8 flex-shrink-0 [&_svg]:!h-6 [&_svg]:!w-6 md:[&_svg]:!h-4 md:[&_svg]:!w-4"
                              aria-label={
                                isMaterialCompleted
                                  ? `Mark ${materialItem.name} as incomplete`
                                  : `Mark ${materialItem.name} as complete`
                              }
                              onClick={() => handleMaterialToggle(materialItem)}
                              disabled={isJobCompleted}
                            >
                              {isMaterialCompleted ? (
                                <CheckCircle2 className="text-green-600" />
                              ) : (
                                <Circle className="text-muted-foreground" />
                              )}
                            </Button>
                          ) : (
                            <div className="flex h-10 w-10 md:h-8 md:w-8 flex-shrink-0 items-start justify-center pt-0.5">
                              <Circle className="h-6 w-6 md:h-4 md:w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <span
                              className={cn(
                                "block text-xl md:text-sm font-semibold",
                                isMaterialCompleted &&
                                  !editMode &&
                                  "line-through text-muted-foreground",
                              )}
                            >
                              {materialItem.name}
                            </span>
                            <span className="block text-base md:text-xs text-muted-foreground">
                              {Number(materialItem.quantity).toLocaleString()} {materialItem.unit} @ ${Number(materialItem.unit_price).toFixed(2)}
                            </span>
                          </div>

                          {editMode && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 md:h-8 md:w-8 p-0"
                                aria-label={`Edit checklist item ${materialItem.name}`}
                                onClick={() => openEditMaterialDialog(materialItem)}
                              >
                                <Pencil className="h-5 w-5 md:h-3.5 md:w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 md:h-8 md:w-8 p-0 text-destructive hover:text-destructive"
                                aria-label={`Delete checklist item ${materialItem.name}`}
                                onClick={async () => {
                                  const linked = getMaterialChecklistItem(materialItem);
                                  if (linked) {
                                    await handleDelete(linked.id);
                                  }
                                  deleteLineItem.mutate(materialItem.id);
                                }}
                              >
                                <Trash2 className="h-5 w-5 md:h-3.5 md:w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const checklistItem = item as ChecklistItem;
                    const isChecklistItemCompleted = isJobCompleted || checklistItem.is_completed;
                    const normalizedLabel = checklistItem.label.toLowerCase();
                    const isPortalItem =
                      normalizedLabel === SEND_CLIENT_PORTAL_CHECKLIST_LABEL.toLowerCase();
                    const isReviewItem = isReviewRequestChecklistItem(checklistItem.label);

                    return (
                      <div
                        key={item.id}
                        data-task-row-id={section.category === "task" ? checklistItem.id : undefined}
                        className={cn(
                          "flex items-center gap-3 p-3 transition-colors",
                          !editMode && !isJobCompleted && "hover:bg-muted/50",
                          isChecklistItemCompleted && !editMode && "bg-muted/30",
                          section.category === "task" &&
                            editMode &&
                            dragOverTaskId === checklistItem.id &&
                            "bg-muted/50",
                          section.category === "task" &&
                            editMode &&
                            draggedTaskId === checklistItem.id &&
                            "bg-primary/10 ring-2 ring-primary/40 rounded-xl shadow-sm",
                        )}
                        draggable={!isMobile && editMode && section.category === "task"}
                        onDragStart={() => {
                          if (!(editMode && section.category === "task")) return;
                          setDraggedTaskId(checklistItem.id);
                        }}
                        onDragOver={(event) => {
                          if (!(editMode && section.category === "task")) return;
                          event.preventDefault();
                          if (dragOverTaskId !== checklistItem.id) {
                            setDragOverTaskId(checklistItem.id);
                          }
                        }}
                        onDrop={(event) => {
                          if (!(editMode && section.category === "task")) return;
                          event.preventDefault();
                          if (!draggedTaskId) return;
                          void reorderTaskItems(draggedTaskId, checklistItem.id);
                          setDraggedTaskId(null);
                          setDragOverTaskId(null);
                        }}
                        onDragEnd={() => {
                          if (!(editMode && section.category === "task")) return;
                          setDraggedTaskId(null);
                          setDragOverTaskId(null);
                        }}
                      >
                        {!editMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 md:h-8 md:w-8 flex-shrink-0 [&_svg]:!h-6 [&_svg]:!w-6 md:[&_svg]:!h-4 md:[&_svg]:!w-4"
                            aria-label={
                              isChecklistItemCompleted
                                ? `Mark ${checklistItem.label} as incomplete`
                                : `Mark ${checklistItem.label} as complete`
                            }
                            onClick={() => handleToggle(checklistItem)}
                            disabled={isJobCompleted}
                          >
                            {isChecklistItemCompleted ? (
                              <CheckCircle2 className="text-green-600" />
                            ) : (
                              <Circle className="text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        {editMode && section.category === "task" && !isMobile && (
                          <div className="flex h-10 w-10 md:h-8 md:w-8 shrink-0 items-center justify-center text-muted-foreground">
                            <GripVertical className="h-5 w-5 md:h-4 md:w-4" />
                          </div>
                        )}
                        {editMode && section.category === "task" && isMobile && (
                          <button
                            type="button"
                            className={cn(
                              "flex h-10 w-10 md:h-8 md:w-8 shrink-0 items-center justify-center touch-none rounded-lg transition-colors",
                              draggedTaskId === checklistItem.id
                                ? "text-primary bg-primary/15"
                                : "text-muted-foreground",
                            )}
                            aria-label={`Drag to reorder ${checklistItem.label}`}
                            onTouchStart={(event) => {
                              event.preventDefault();
                              setTouchDraggingTaskId(checklistItem.id);
                              setDraggedTaskId(checklistItem.id);
                              setDragOverTaskId(checklistItem.id);
                            }}
                          >
                            <GripVertical className="h-5 w-5 md:h-4 md:w-4" />
                          </button>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <span
                            className={cn(
                              "block font-semibold",
                              normalizedLabel === "navigate to address"
                                ? "text-base"
                                : "text-xl md:text-sm",
                              isChecklistItemCompleted && !editMode && "line-through text-muted-foreground",
                            )}
                          >
                            {checklistItem.label}
                          </span>
                        </div>

                        {!editMode && (isPortalItem || (isReviewItem && shouldShowPortalCopyHint)) && clientPortalUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyPortalLink();
                            }}
                          >
                            {copiedPortal ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedPortal ? "Copied" : "Copy Link"}
                          </Button>
                        )}

                        {!editMode && (isPortalItem || (isReviewItem && shouldShowPortalCopyHint)) && !clientPortalUrl && (
                          onGoToDetailsTab ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs shrink-0"
                              onClick={onGoToDetailsTab}
                            >
                              Generate Link
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-lg md:text-xs text-muted-foreground shrink-0">
                              Generate link in Details tab
                            </span>
                          )
                        )}

                        {editMode && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 md:h-8 md:w-8 p-0"
                                aria-label={`Edit checklist item ${checklistItem.label}`}
                                onClick={() => openEditDialog(checklistItem)}
                              >
                                <Pencil className="h-5 w-5 md:h-3.5 md:w-3.5" />
                              </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 md:h-8 md:w-8 p-0 text-destructive hover:text-destructive"
                                aria-label={`Delete checklist item ${checklistItem.label}`}
                                onClick={() => handleDelete(checklistItem.id)}
                              >
                                <Trash2 className="h-5 w-5 md:h-3.5 md:w-3.5" />
                              </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {editMode && (
                <button
                  type="button"
                  onClick={() => openAddDialog(section.category)}
                  className={cn(
                    "w-full",
                    "flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40",
                  )}
                  aria-label={section.addLabel}
                >
                  <div className="flex h-10 w-10 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground">
                    <Plus className="h-5 w-5 md:h-4 md:w-4" />
                  </div>
                  <span className="block text-xl md:text-sm text-muted-foreground">
                    {section.addLabel}
                  </span>
                </button>
              )}
            </section>
          );
        })}

        <div className="!border-t-0 border-border my-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleCompleteClick}
            disabled={isJobCompleted || editMode}
          >
            {isJobCompleted ? (
              <CheckCircle2 />
            ) : (
              <CheckCircle2 />
            )}
            <span className={cn(isJobCompleted && "line-through text-muted-foreground")}>
              Complete
            </span>
          </Button>
        </div>
      </div>

      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) {
            resetEditor();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.category === "material"
                ? editor.mode === "add"
                  ? "Add Material"
                  : "Edit Material"
                : editor.mode === "add"
                  ? "Add Checklist Item"
                  : "Edit Checklist Item"}
            </DialogTitle>
            <DialogDescription className="text-base md:text-sm">
              {editor.category === "material"
                ? editor.mode === "add"
                  ? "Add a material line item for this job. This syncs with Job Costs."
                  : "Update this material line item for the job. This syncs with Job Costs."
                : editor.mode === "add"
                  ? "Add a checklist item for this job."
                  : "Update this checklist item for the job."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-category">
                Category
              </label>
              <Select
                value={editor.category}
                onValueChange={(value) =>
                  setEditor((current) => ({
                    ...current,
                    category: value as Exclude<ChecklistItemCategory, "standard">,
                  }))
                }
              >
                <SelectTrigger
                  id="checklist-item-category"
                  aria-label={editor.mode === "add" ? "New checklist item category" : "Checklist item category"}
                  className="w-full h-12 md:h-10 text-base md:text-sm"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-label">
                {editor.category === "material" ? "Material name" : "Item label"}
              </label>
              <div className="relative">
                <Input
                  id="checklist-item-label"
                  className="h-12 md:h-10"
                  value={editor.label}
                  onChange={(e) => setEditor((current) => ({ ...current, label: e.target.value }))}
                  onFocus={() => {
                    if (editor.category === "material") {
                      setIsMaterialNameFocused(true);
                    }
                  }}
                  onBlur={() => {
                    if (editor.category === "material") {
                      setIsMaterialNameFocused(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSaveItem();
                    }
                  }}
                  placeholder={
                    editor.category === "material"
                      ? "Material name"
                      : editor.mode === "add" && !hasReviewRequestItem
                      ? `Add new item... (${DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL} is recommended)`
                      : "Add new item..."
                  }
                  autoFocus
                />
                {editor.category === "material" &&
                isMaterialNameFocused &&
                normalizedMaterialTemplateQuery.length > 0 ? (
                  matchingMaterialTemplates.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 border border-border rounded-md bg-background p-1 space-y-1 shadow-md">
                      {matchingMaterialTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applyMaterialTemplate(template);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ${Number(template.unit_price || 0).toFixed(2)} / {template.unit || "each"}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 border border-border rounded-md bg-background p-2 shadow-md">
                      <p className="text-xs text-muted-foreground">No material template match.</p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
            {editor.category === "material" && (
              <>
                <div className="space-y-2">
                  <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-description">
                    Description
                  </label>
                  <Input
                    id="checklist-item-description"
                    className="h-12 md:h-10"
                    value={editor.description}
                    onChange={(e) => setEditor((current) => ({ ...current, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-quantity">
                      Qty
                    </label>
                    <Input
                      id="checklist-item-quantity"
                      type="number"
                      step="0.01"
                      className="h-12 md:h-10"
                      value={editor.quantity}
                      onChange={(e) => setEditor((current) => ({ ...current, quantity: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-unit">
                      Unit
                    </label>
                    <Select
                      value={normalizeMaterialUnit(editor.unit)}
                      onValueChange={(value) => setEditor((current) => ({ ...current, unit: value }))}
                    >
                      <SelectTrigger
                        id="checklist-item-unit"
                        aria-label="Checklist item unit"
                        className="w-full h-12 md:h-10 text-base md:text-sm"
                      >
                        <SelectValue placeholder="each" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_UNIT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-base md:text-sm font-medium" htmlFor="checklist-item-unit-price">
                      Unit Price
                    </label>
                    <Input
                      id="checklist-item-unit-price"
                      type="number"
                      step="0.01"
                      className="h-12 md:h-10"
                      value={editor.unit_price}
                      onChange={(e) => setEditor((current) => ({ ...current, unit_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={resetEditor}>
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => void handleSaveItem()}
              disabled={!editor.label.trim()}
              aria-label={editor.mode === "add" ? "Add checklist item" : "Save checklist item"}
            >
              {editor.category === "material" ? (
                editor.mode === "add" ? (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Material
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Material
                  </>
                )
              ) : editor.mode === "add" ? (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Job as Complete?</AlertDialogTitle>
            <AlertDialogDescription>
              All checklist items will be checked off. Would you like to mark this job as complete?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel size="lg" className="mt-0 flex-1" onClick={() => setCompleteDialogOpen(false)} disabled={markingComplete}>
              No, Keep Open
            </AlertDialogCancel>
            <AlertDialogAction size="lg" className="flex-1" onClick={handleConfirmComplete} disabled={markingComplete}>
              {markingComplete ? "Completing..." : "Yes, Mark Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
