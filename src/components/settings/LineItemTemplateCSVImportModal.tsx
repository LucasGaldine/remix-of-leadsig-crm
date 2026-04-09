import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { createLineItemTemplate } from "@/lib/lineItemTemplates";
import {
  autoMapLineItemTemplateColumns,
  buildLineItemTemplatePayloadFromRow,
  getLineItemTemplateCombineInfo,
  LINE_ITEM_TEMPLATE_FIELDS,
  parseLineItemTemplateCsv,
  type LineItemTemplateColumnMapping,
} from "@/lib/lineItemTemplateCsv";
import { toast } from "sonner";

interface LineItemTemplateCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = "upload" | "mapping" | "importing" | "done";
const SKIP_VALUE = "__skip__";

export function LineItemTemplateCSVImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: LineItemTemplateCSVImportModalProps) {
  const { currentAccount } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<LineItemTemplateColumnMapping>({});
  const [importResult, setImportResult] = useState({ success: 0, failed: 0, errors: [] as string[] });

  const rowCount = csvRows.length;
  const hasNameMapping = Object.values(mapping).includes("name");
  const combineInfo = getLineItemTemplateCombineInfo(mapping, csvHeaders);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setDragOver(false);
    setImporting(false);
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setImportResult({ success: 0, failed: 0, errors: [] });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseLineItemTemplateCsv(text);

      if (!parsed.headers.length || !parsed.rows.length) {
        toast.error("CSV file must include headers and at least one row");
        return;
      }

      setFileName(file.name);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMapping(autoMapLineItemTemplateColumns(parsed.headers));
      setStep("mapping");
    };
    reader.onerror = () => {
      toast.error("Could not read CSV file");
    };

    reader.readAsText(file);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleMappingChange = (header: string, value: string) => {
    setMapping((prev) => ({ ...prev, [header]: value === SKIP_VALUE ? "" : value }));
  };

  const handleImport = async () => {
    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    if (!hasNameMapping) {
      toast.error("You must map at least the Title field");
      return;
    }

    setStep("importing");
    setImporting(true);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const rowNumber = i + 2;

      const payload = buildLineItemTemplatePayloadFromRow(csvHeaders, row, mapping);
      if (!payload) {
        failed += 1;
        errors.push(`Row ${rowNumber}: Missing template title`);
        continue;
      }

      const created = await createLineItemTemplate(currentAccount.id, payload);
      if (!created) {
        failed += 1;
        errors.push(`Row ${rowNumber}: Failed to create template`);
      } else {
        success += 1;
      }
    }

    setImporting(false);
    setImportResult({ success, failed, errors });
    setStep("done");

    if (!success) {
      toast.error("No templates were imported.");
      return;
    }

    toast.success(`Imported ${success} template${success === 1 ? "" : "s"}.`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Line Item Templates"}
            {step === "mapping" && "Map CSV Columns"}
            {step === "importing" && "Importing Templates..."}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file containing line item templates."}
            {step === "mapping" && "Match each CSV column to a template field before importing."}
            {step === "importing" && "Please wait while your templates are being imported."}
            {step === "done" && `Processed ${importResult.success + importResult.failed} rows.`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Click to browse or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">CSV files up to 5MB</p>
            </button>
          </div>
        )}

        {step === "mapping" && (
          <div className="flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{rowCount} rows</span>
            </div>

            <ScrollArea className="h-[340px]">
              <div className="space-y-3 px-1 py-1">
                {csvHeaders.map((header) => {
                  const currentValue = mapping[header] || "";
                  const fieldHeaders = currentValue ? combineInfo[currentValue as keyof typeof combineInfo] : undefined;
                  const isCombined = !!fieldHeaders && fieldHeaders.length > 1;
                  const combineIndex = isCombined ? fieldHeaders.indexOf(header) + 1 : 0;
                  const fieldLabel = currentValue
                    ? LINE_ITEM_TEMPLATE_FIELDS.find((field) => field.key === currentValue)?.label
                    : "";

                  return (
                    <div key={header} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {csvRows[0]?.[csvHeaders.indexOf(header)] || "\u2014"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="shrink-0 w-[170px]">
                        <Select
                          value={currentValue || SKIP_VALUE}
                          onValueChange={(value) => handleMappingChange(header, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>
                              <span className="text-muted-foreground">Skip column</span>
                            </SelectItem>
                            {LINE_ITEM_TEMPLATE_FIELDS.map((field) => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.label}
                                {field.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isCombined && (
                          <p className="mt-1 text-xs text-primary">
                            {fieldLabel} {combineIndex} of {fieldHeaders.length}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {!hasNameMapping && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>The Title field must be mapped to proceed.</span>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Importing templates...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-sm">{importResult.success} templates imported</p>
                {importResult.failed > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">{importResult.failed} rows skipped</p>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Issues:</p>
                <ScrollArea className="max-h-[120px]">
                  <ul className="space-y-1">
                    {importResult.errors.slice(0, 20).map((errorText, index) => (
                      <li key={`${index}-${errorText}`} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <X className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        {errorText}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Back
              </Button>
              <Button type="button" onClick={handleImport} disabled={!hasNameMapping || importing}>
                Import {rowCount} Templates
              </Button>
            </>
          )}
          {step === "done" && (
            <Button
              type="button"
              onClick={() => {
                handleClose(false);
                onImportComplete?.();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
