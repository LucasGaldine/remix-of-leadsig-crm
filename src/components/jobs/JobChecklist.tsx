import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Trash2,
  X,
  Save,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useJobChecklist, ChecklistItem } from "@/hooks/useJobChecklist";
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
  isManager?: boolean;
  onMarkComplete?: () => Promise<void> | void;
  hasBeforePhotos?: boolean;
}

export function JobChecklist({
  jobId,
  jobStatus,
  isEstimateVisit,
  clientPortalUrl,
  isManager = false,
  onMarkComplete,
  hasBeforePhotos = false,
}: JobChecklistProps) {
  const { items, isLoading, toggleItem, addItem, updateItem, deleteItem } =
    useJobChecklist(jobId);
  const [editMode, setEditMode] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [pendingToggleItem, setPendingToggleItem] = useState<ChecklistItem | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const handleToggle = async (item: ChecklistItem) => {
    if (editMode) return;

    // If checking the last unchecked item (would complete all items)
    if (!item.is_completed) {
      const uncheckedCount = items.filter((i) => !i.is_completed).length;
      if (uncheckedCount === 1) {
        // This is the last item — check requirements first
        if (isEstimateVisit && !hasBeforePhotos) {
          toast.error("Before photos must be uploaded before marking this job as complete");
          return;
        }
        // Show confirmation modal
        setPendingToggleItem(item);
        setCompleteDialogOpen(true);
        return;
      }
    }

    try {
      await toggleItem.mutateAsync({
        id: item.id,
        is_completed: !item.is_completed,
      });
    } catch {
      toast.error("Failed to update checklist item");
    }
  };

  const handleConfirmComplete = async () => {
    if (!pendingToggleItem) return;
    setMarkingComplete(true);
    try {
      await toggleItem.mutateAsync({
        id: pendingToggleItem.id,
        is_completed: true,
      });
      if (onMarkComplete) {
        await onMarkComplete();
      }
      toast.success("Job marked as complete");
    } catch {
      toast.error("Failed to complete job");
    } finally {
      setMarkingComplete(false);
      setPendingToggleItem(null);
      setCompleteDialogOpen(false);
    }
  };

  const handleCancelComplete = () => {
    setPendingToggleItem(null);
    setCompleteDialogOpen(false);
  };

  const handleAdd = async () => {
    const label = newItemLabel.trim();
    if (!label) return;
    try {
      await addItem.mutateAsync({
        label,
        sort_order: items.length,
      });
      setNewItemLabel("");
    } catch {
      toast.error("Failed to add checklist item");
    }
  };

  const handleSaveEdit = async (id: string) => {
    const label = editingLabel.trim();
    if (!label) return;
    try {
      await updateItem.mutateAsync({ id, label });
      setEditingId(null);
      setEditingLabel("");
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingLabel(item.label);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        {isManager && (
          <Button
            variant={editMode ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setEditMode(!editMode);
              setEditingId(null);
              setNewItemLabel("");
            }}
          >
            {editMode ? (
              <>
                <Save className="h-4 w-4 mr-1" />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </>
            )}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
        {items.map((item) => {
          const isPortalItem =
            item.label.toLowerCase() === "send client portal";

          if (editMode && editingId === item.id) {
            return (
              <div key={item.id} className="flex items-center gap-2 p-3">
                <Input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 h-9"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => handleSaveEdit(item.id)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 transition-colors",
                !editMode && "cursor-pointer hover:bg-muted/50",
                item.is_completed && !editMode && "bg-muted/30"
              )}
              onClick={() => !editMode && handleToggle(item)}
            >
              {!editMode && (
                <div className="flex-shrink-0">
                  {item.is_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
              <span
                className={cn(
                  "flex-1 text-sm",
                  item.is_completed && !editMode &&
                    "line-through text-muted-foreground"
                )}
              >
                {item.label}
              </span>

              {!editMode && isPortalItem && clientPortalUrl && (
                <Button
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

              {!editMode && isPortalItem && !clientPortalUrl && (
                <span className="text-xs text-muted-foreground shrink-0">
                  Generate link in Details tab
                </span>
              )}

              {editMode && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {editMode && (
          <div className="flex items-center gap-2 p-3 bg-muted/20">
            <Input
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Add new item..."
              className="flex-1 h-9"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleAdd}
              disabled={!newItemLabel.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            allComplete ? "bg-green-600" : "bg-primary"
          )}
          style={{
            width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
          }}
        />
      </div>

      {/* Completion confirmation dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Job as Complete?</AlertDialogTitle>
            <AlertDialogDescription>
              All checklist items will be checked off. Would you like to mark this job as complete?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelComplete} disabled={markingComplete}>
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
