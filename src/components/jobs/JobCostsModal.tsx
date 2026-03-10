import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useJobLineItems, LineItemCategory } from "@/hooks/useJobLineItems";
import { Receipt, RefreshCw, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
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

export const JobCostsModal = ({ jobId, open, onOpenChange }: JobCostsModalProps) => {
  const { lineItems, isLoading, totalCost, resyncFromEstimate, addLineItem, updateLineItem, deleteLineItem } = useJobLineItems(jobId);
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

  const startEdit = (item: any) => {
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
    if (!editingData) return;

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
    if (deleteId) {
      deleteLineItem.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Job Costs
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resyncFromEstimate.mutate()}
              disabled={resyncFromEstimate.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${resyncFromEstimate.isPending ? 'animate-spin' : ''}`} />
              Resync from Estimate
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(true)}
                disabled={isAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </div>

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
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editingData.description}
                            onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editingData.category}
                            onValueChange={(value) => setEditingData({ ...editingData, category: value as LineItemCategory })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="materials">Materials</SelectItem>
                              <SelectItem value="labor">Labor</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingData.quantity}
                              onChange={(e) => setEditingData({ ...editingData, quantity: e.target.value })}
                              className="h-8 w-16"
                            />
                            <Input
                              value={editingData.unit}
                              onChange={(e) => setEditingData({ ...editingData, unit: e.target.value })}
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
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${((parseFloat(editingData.quantity) || 0) * (parseFloat(editingData.unit_price) || 0)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveEdit}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description || "—"}
                        </TableCell>
                        <TableCell className="capitalize text-sm">
                          {item.category}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(item.quantity).toLocaleString()} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          ${Number(item.unit_price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(item.total).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteId(item.id)}
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
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Description"
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={newItem.category}
                          onValueChange={(value) => setNewItem({ ...newItem, category: value as LineItemCategory })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="materials">Materials</SelectItem>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                            className="h-8 w-16"
                          />
                          <Input
                            value={newItem.unit}
                            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
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
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${((parseFloat(newItem.quantity) || 0) * (parseFloat(newItem.unit_price) || 0)).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleAdd}
                            disabled={!newItem.name.trim()}
                            className="h-8 w-8 p-0"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsAdding(false);
                              setNewItem({
                                name: "",
                                description: "",
                                quantity: "1",
                                unit: "each",
                                unit_price: "0",
                                category: "other" as LineItemCategory,
                              });
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

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                  <p className="text-2xl font-bold">
                    ${totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
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
