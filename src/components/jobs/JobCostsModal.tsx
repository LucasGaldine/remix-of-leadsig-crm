import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useJobLineItems, LineItemCategory } from "@/hooks/useJobLineItems";
import { RefreshCw, Plus, Pencil, Trash2, Check, X, ScanLine } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef } from "react";
import { toast } from "sonner";
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

interface JobCostsModalProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditingLineItem {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: LineItemCategory;
}

const CATEGORY_OPTIONS: { value: LineItemCategory; label: string }[] = [
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "other", label: "Other" },
];

export const JobCostsModal = ({ jobId, open, onOpenChange }: JobCostsModalProps) => {
  const {
    lineItems,
    isLoading,
    totalCost,
    hasApprovedEstimate,
    resyncFromEstimate,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  } = useJobLineItems(jobId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingLineItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    quantity: "1",
    unit: "each",
    unit_price: "0",
    category: "other" as LineItemCategory,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const MAX_COLLAPSED_DESCRIPTION_LENGTH = 140;
  const editingLocked = !hasApprovedEstimate;

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingLocked) return;

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
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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

      const maxSortOrder = Math.max(...lineItems.map((item) => item.sort_order), 0);
      for (let i = 0; i < scannedItems.length; i++) {
        const item = scannedItems[i];
        await addLineItem.mutateAsync({
          lead_id: jobId,
          name: item.name,
          description: item.description ?? null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: maxSortOrder + i + 1,
          estimate_line_item_id: null,
          category: "materials" as LineItemCategory,
        });
      }

      toast.success(`Added ${scannedItems.length} item${scannedItems.length !== 1 ? "s" : ""} from receipt`);
    } catch (err) {
      console.error("Receipt scan error:", err);
      toast.error("Failed to scan receipt. Please try again.");
    } finally {
      setIsScanningReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  const startEdit = (item: any) => {
    if (editingLocked) return;

    setEditingId(item.id);
    setEditingData({
      id: item.id,
      name: item.name,
      description: item.description || "",
      quantity: String(item.quantity),
      unit: item.unit,
      unit_price: String(item.unit_price),
      category: item.category || 'other',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
  };

  const saveEdit = () => {
    if (editingLocked || !editingData) return;

    const quantity = parseFloat(editingData.quantity) || 0;
    const unitPrice = parseFloat(editingData.unit_price) || 0;

    updateLineItem.mutate({
      id: editingData.id,
      name: editingData.name,
      description: editingData.description || null,
      quantity,
      unit: editingData.unit,
      unit_price: unitPrice,
      total: quantity * unitPrice,
      category: editingData.category,
    });

    cancelEdit();
  };

  const handleAdd = () => {
    if (editingLocked) return;

    const quantity = parseFloat(newItem.quantity) || 0;
    const unitPrice = parseFloat(newItem.unit_price) || 0;
    const maxSortOrder = Math.max(...lineItems.map(item => item.sort_order), 0);

    addLineItem.mutate({
      lead_id: jobId,
      name: newItem.name,
      description: newItem.description || null,
      quantity,
      unit: newItem.unit,
      unit_price: unitPrice,
      total: quantity * unitPrice,
      sort_order: maxSortOrder + 1,
      estimate_line_item_id: null,
      category: newItem.category,
    });

    setNewItem({
      name: "",
      description: "",
      quantity: "1",
      unit: "each",
      unit_price: "0",
      category: "other" as LineItemCategory,
    });
    setIsAdding(false);
  };

  const handleDelete = () => {
    if (editingLocked) {
      setDeleteId(null);
      return;
    }

    if (deleteId) {
      deleteLineItem.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasCollapsibleDescription = (description: string | null | undefined) =>
    (description?.trim().length ?? 0) > MAX_COLLAPSED_DESCRIPTION_LENGTH;

  const isDescriptionExpanded = (lineItemId: string) => !!expandedDescriptions[lineItemId];

  const toggleDescription = (lineItemId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [lineItemId]: !prev[lineItemId],
    }));
  };

  const renderMobileEditForm = (
    data: typeof newItem | EditingLineItem,
    setData: (d: any) => void,
    onSave: () => void,
    onCancel: () => void,
    saveDisabled?: boolean,
    isDisabled?: boolean,
  ) => (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Item</label>
          <Input
            placeholder="Item name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            disabled={isDisabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <Select
            value={data.category}
            onValueChange={(value) => setData({ ...data, category: value as LineItemCategory })}
            disabled={isDisabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Description</label>
        <Input
          placeholder="Description"
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          disabled={isDisabled}
          className="h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
          <Input
            type="number"
            value={data.quantity}
            onChange={(e) => setData({ ...data, quantity: e.target.value })}
            disabled={isDisabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
          <Input
            value={data.unit}
            onChange={(e) => setData({ ...data, unit: e.target.value })}
            disabled={isDisabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unit Price</label>
          <Input
            type="number"
            step="0.01"
            value={data.unit_price}
            onChange={(e) => setData({ ...data, unit_price: e.target.value })}
            disabled={isDisabled}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm font-medium">
          Total: {formatCurrency((parseFloat(data.quantity) || 0) * (parseFloat(data.unit_price) || 0))}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={isDisabled || saveDisabled} className="h-8">
            Save
          </Button>
        </div>
      </div>
    </div>
  );

  const renderMobileCard = (item: any) => {
    if (editingId === item.id && editingData) {
      return (
        <div key={item.id}>
          {renderMobileEditForm(
            editingData,
            (d: EditingLineItem) => setEditingData(d),
            saveEdit,
            cancelEdit,
            undefined,
            editingLocked,
          )}
        </div>
      );
    }

    return (
      <div key={item.id} className="border rounded-lg p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{item.name}</p>
            {item.description && (
              <div className="mt-0.5">
                <p className={`text-xs text-muted-foreground whitespace-pre-wrap ${!isDescriptionExpanded(item.id) ? "line-clamp-3" : ""}`}>
                  {item.description}
                </p>
                {hasCollapsibleDescription(item.description) && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => toggleDescription(item.id)}
                  >
                    {isDescriptionExpanded(item.id) ? "View less" : "View more"}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="capitalize">{item.category}</span>
              <span>{Number(item.quantity).toLocaleString()} {item.unit}</span>
              <span>{formatCurrency(Number(item.unit_price))}/ea</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">{formatCurrency(Number(item.total))}</p>
            <div className="flex gap-0.5 mt-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEdit(item)}
                aria-label={`Edit ${item.name}`}
                disabled={editingLocked}
                className="h-7 w-7 p-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteId(item.id)}
                aria-label={`Delete ${item.name}`}
                disabled={editingLocked}
                className="h-7 w-7 p-0 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogDescription className="sr-only">View and manage job costs for this job.</DialogDescription>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DialogTitle>Job Costs</DialogTitle>

            <div className="flex gap-2 pr-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resyncFromEstimate.mutate()}
              disabled={editingLocked || resyncFromEstimate.isPending}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${resyncFromEstimate.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Resync from Estimate</span>
              <span className="sm:hidden">Resync</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => receiptInputRef.current?.click()}
              disabled={editingLocked || isScanningReceipt}
              className="shrink-0"
            >
              <ScanLine className={`h-4 w-4 mr-2 ${isScanningReceipt ? 'animate-pulse' : ''}`} />
              {isScanningReceipt ? "Scanning..." : "Scan Receipt"}
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={editingLocked}
              onChange={handleScanReceipt}
            />

            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(true)}
                disabled={editingLocked || isAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
              </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {editingLocked && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Estimate must be approved before you can edit or resync job costs.
              </div>
            )}

            {/* Mobile card layout */}
            <div className="md:hidden">
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {isAdding && renderMobileEditForm(
                    newItem,
                    (d: typeof newItem) => setNewItem(d),
                    handleAdd,
                    () => {
                      setIsAdding(false);
                      setNewItem({ name: "", description: "", quantity: "1", unit: "each", unit_price: "0", category: "other" as LineItemCategory });
                    },
                    !newItem.name.trim(),
                    editingLocked,
                  )}
                  {lineItems.map(renderMobileCard)}
                  {lineItems.length === 0 && !isAdding && (
                    <p className="text-center text-sm text-muted-foreground py-8">No line items yet</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block">
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[20%]">Item</TableHead>
                      <TableHead className="w-[20%]">Description</TableHead>
                      <TableHead className="w-[12%]">Category</TableHead>
                      <TableHead className="text-right w-[12%]">Quantity</TableHead>
                      <TableHead className="text-right w-[12%]">Unit Price</TableHead>
                      <TableHead className="text-right w-[12%]">Total</TableHead>
                      <TableHead className="w-[12%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      editingId === item.id && editingData ? (
                        <TableRow key={item.id}>
                          <TableCell>
                              <Input
                                value={editingData.name}
                                onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                                disabled={editingLocked}
                                className="h-8"
                              />
                          </TableCell>
                          <TableCell>
                              <Input
                                value={editingData.description}
                                onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                                disabled={editingLocked}
                                className="h-8"
                              />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editingData.category}
                              onValueChange={(value) => setEditingData({ ...editingData, category: value as LineItemCategory })}
                              disabled={editingLocked}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={editingData.quantity}
                                onChange={(e) => setEditingData({ ...editingData, quantity: e.target.value })}
                                disabled={editingLocked}
                                className="h-8 w-16"
                              />
                              <Input
                                value={editingData.unit}
                                onChange={(e) => setEditingData({ ...editingData, unit: e.target.value })}
                                disabled={editingLocked}
                                className="h-8 w-20"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingData.unit_price}
                              onChange={(e) => setEditingData({ ...editingData, unit_price: e.target.value })}
                              disabled={editingLocked}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency((parseFloat(editingData.quantity) || 0) * (parseFloat(editingData.unit_price) || 0))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={saveEdit} disabled={editingLocked} className="h-8 w-8 p-0">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.description ? (
                              <div>
                                <p className={`whitespace-pre-wrap break-words ${!isDescriptionExpanded(item.id) ? "line-clamp-3" : ""}`}>
                                  {item.description}
                                </p>
                                {hasCollapsibleDescription(item.description) && (
                                  <button
                                    type="button"
                                    className="mt-1 text-xs font-medium text-primary hover:underline"
                                    onClick={() => toggleDescription(item.id)}
                                  >
                                    {isDescriptionExpanded(item.id) ? "View less" : "View more"}
                                  </button>
                                )}
                              </div>
                            ) : "\u2014"}
                          </TableCell>
                          <TableCell className="capitalize text-sm">
                            {item.category}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.quantity).toLocaleString()} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.unit_price))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(item.total))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(item)}
                                aria-label={`Edit ${item.name}`}
                                disabled={editingLocked}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteId(item.id)}
                                aria-label={`Delete ${item.name}`}
                                disabled={editingLocked}
                                className="h-8 w-8 p-0 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    ))}

                    {isAdding && (
                      <TableRow>
                        <TableCell>
                          <Input
                            placeholder="Item name"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            disabled={editingLocked}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Description"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            disabled={editingLocked}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={newItem.category}
                            onValueChange={(value) => setNewItem({ ...newItem, category: value as LineItemCategory })}
                            disabled={editingLocked}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                              disabled={editingLocked}
                              className="h-8 w-16"
                            />
                            <Input
                              value={newItem.unit}
                              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                              disabled={editingLocked}
                              className="h-8 w-20"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={newItem.unit_price}
                            onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                            disabled={editingLocked}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((parseFloat(newItem.quantity) || 0) * (parseFloat(newItem.unit_price) || 0))}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleAdd}
                              disabled={editingLocked || !newItem.name.trim()}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIsAdding(false);
                                setNewItem({ name: "", description: "", quantity: "1", unit: "each", unit_price: "0", category: "other" as LineItemCategory });
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                  <p className="text-2xl font-bold">-{formatCurrency(totalCost)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this line item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
