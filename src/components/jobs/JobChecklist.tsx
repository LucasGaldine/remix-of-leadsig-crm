import { useMemo, useState } from "react";
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
  Info,
  ArrowRight,
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
}

type ChecklistEditorMode = "add" | "edit";

interface ChecklistEditorState {
  open: boolean;
  mode: ChecklistEditorMode;
  itemId: string | null;
  label: string;
  category: Exclude<ChecklistItemCategory, "standard">;
}

const DEFAULT_EDITOR_STATE: ChecklistEditorState = {
  open: false,
  mode: "add",
  itemId: null,
  label: "",
  category: "task",
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
}: JobChecklistProps) {
  const { items, isLoading, toggleItem, addItem, updateItem, deleteItem } =
    useJobChecklist(jobId);
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<ChecklistEditorState>(DEFAULT_EDITOR_STATE);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  const isJobCompleted = jobStatus === "completed" || jobStatus === "paid";
  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
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

  const getDisplayCategory = (
    item: ChecklistItem,
  ): Exclude<ChecklistItemCategory, "standard"> => {
    const category = getChecklistItemCategory(item.metadata);
    return category === "standard" ? "task" : category;
  };

  const sectionItems = useMemo(
    () => ({
      task: items.filter((item) => getDisplayCategory(item) === "task"),
      tool: items.filter((item) => getDisplayCategory(item) === "tool"),
      material: items.filter((item) => getDisplayCategory(item) === "material"),
    }),
    [items],
  );

  const checklistSections: {
    category: Exclude<ChecklistItemCategory, "standard">;
    title: string;
    icon: typeof ClipboardList;
  }[] = [
    { category: "task", title: "Tasks", icon: ClipboardList },
    { category: "tool", title: "Tools", icon: Wrench },
    { category: "material", title: "Materials", icon: Package },
  ];

  const resetEditor = () => setEditor(DEFAULT_EDITOR_STATE);

  const openAddDialog = (category: Exclude<ChecklistItemCategory, "standard"> = "task") => {
    setEditor({
      open: true,
      mode: "add",
      itemId: null,
      label: "",
      category,
    });
  };

  const openEditDialog = (item: ChecklistItem) => {
    setEditor({
      open: true,
      mode: "edit",
      itemId: item.id,
      label: item.label,
      category: getDisplayCategory(item),
    });
  };

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
      const uncheckedItems = items.filter((item) => !item.is_completed);
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

      resetEditor();
    } catch {
      toast.error(editor.mode === "add" ? "Failed to add checklist item" : "Failed to update item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
    } catch {
      toast.error("Failed to delete item");
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (items.length === 0 && !editMode) {
    return (
      <div className="space-y-3">
        <div className="text-center py-12">
          <Circle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No checklist items</p>
          {isManager && (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Checklist Items
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{totalCount} complete
          </span>
          {allComplete && (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              All done
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allComplete ? "bg-green-600" : "bg-primary",
              )}
              style={{
                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
              }}
            />
          </div>
        </div>
        {isManager && !isJobCompleted && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              variant={editMode ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setEditMode(!editMode);
                resetEditor();
              }}
            >
              {editMode ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Done
                </>
              ) : (
                <div className="text-muted-foreground flex gap-1 justify-center items-center">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </div>
              )}
            </Button>

            {editMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 justify-center gap-2 [&_svg]:size-4"
                onClick={() => openAddDialog("task")}
                aria-label="Add task"
              >
                <Plus className="h-4 w-4" />
                <span>Add task</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {editMode && (
        <div
          role="status"
          className="mt-3 mb-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span className="font-medium">Editing checklist</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Add, edit, or delete items, then select Done to return to checkoff mode.
          </p>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden divide-y divide-border",
          embedded ? "" : "rounded-lg border border-border bg-card",
        )}
      >
        {checklistSections.map((section) => {
          const Icon = section.icon;
          const sectionList = sectionItems[section.category];

          return (
            <section
              key={section.category}
              aria-labelledby={`checklist-section-${section.category}`}
              className="p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 id={`checklist-section-${section.category}`} className="text-sm font-medium">
                    {section.title}
                  </h3>
                  <span className="text-xs text-muted-foreground">({sectionList.length})</span>
                </div>
              </div>
              {sectionList.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-2">
                  No {section.title.toLowerCase()} yet
                </p>
              ) : (
                <div>
                  {sectionList.map((item) => {
                    const normalizedLabel = item.label.toLowerCase();
                    const isPortalItem =
                      normalizedLabel === SEND_CLIENT_PORTAL_CHECKLIST_LABEL.toLowerCase();
                    const isReviewItem = isReviewRequestChecklistItem(item.label);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 transition-colors",
                          "border-b border-border last:border-b-0",
                          !editMode && !isJobCompleted && "hover:bg-muted/50",
                          item.is_completed && !editMode && "bg-muted/30",
                        )}
                      >
                        {!editMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            aria-label={
                              item.is_completed
                                ? `Mark ${item.label} as incomplete`
                                : `Mark ${item.label} as complete`
                            }
                            onClick={() => handleToggle(item)}
                            disabled={isJobCompleted}
                          >
                            {item.is_completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <span
                            className={cn(
                              "block text-sm",
                              item.is_completed && !editMode && "line-through text-muted-foreground",
                            )}
                          >
                            {item.label}
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
                            <span className="text-xs text-muted-foreground shrink-0">
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
                              className="h-8 w-8 p-0"
                              aria-label={`Edit checklist item ${item.label}`}
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              aria-label={`Delete checklist item ${item.label}`}
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        <div className="!border-t-0 border-border ">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 rounded-full p-3 w-full my-4 [&_svg]:size-5 hover:text-green-600 hover:border-green-600 hover:bg-card"
            onClick={handleCompleteClick}
            disabled={isJobCompleted || editMode}
          >
            {isJobCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 " />
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
              {editor.mode === "add" ? "Add Checklist Item" : "Edit Checklist Item"}
            </DialogTitle>
            <DialogDescription>
              {editor.mode === "add"
                ? "Add a checklist item for this job."
                : "Update this checklist item for the job."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="checklist-item-category">
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
                  className="w-full"
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
              <label className="text-sm font-medium" htmlFor="checklist-item-label">
                Item label
              </label>
              <Input
                id="checklist-item-label"
                value={editor.label}
                onChange={(e) => setEditor((current) => ({ ...current, label: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSaveItem();
                  }
                }}
                placeholder={
                  editor.mode === "add" && !hasReviewRequestItem
                    ? `Add new item... (${DEFAULT_REVIEW_REQUEST_CHECKLIST_LABEL} is recommended)`
                    : "Add new item..."
                }
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetEditor}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveItem()}
              disabled={!editor.label.trim()}
              aria-label={editor.mode === "add" ? "Add checklist item" : "Save checklist item"}
            >
              {editor.mode === "add" ? (
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
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompleteDialogOpen(false)} disabled={markingComplete}>
              No, Keep Open
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete} disabled={markingComplete}>
              {markingComplete ? "Completing..." : "Yes, Mark Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
