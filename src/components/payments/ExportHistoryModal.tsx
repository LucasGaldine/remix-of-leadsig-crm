import { FileSpreadsheet, Trash2, Loader as Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useFinancialExportHistory, useDeleteExport } from "@/hooks/useFinancialExports";

interface ExportHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportHistoryModal({ open, onOpenChange }: ExportHistoryModalProps) {
  const { data: exports = [], isLoading } = useFinancialExportHistory();
  const deleteExport = useDeleteExport();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export History</DialogTitle>
          <DialogDescription>
            View your previous financial data exports.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exports.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No exports yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Export your financial data to see it here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {exports.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exp.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(exp.date_from), "MMM d")} -{" "}
                        {format(new Date(exp.date_to), "MMM d, yyyy")}
                        {" "}&middot;{" "}
                        {exp.record_count} record{exp.record_count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Exported {format(new Date(exp.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteExport.mutate(exp.id)}
                    disabled={deleteExport.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
