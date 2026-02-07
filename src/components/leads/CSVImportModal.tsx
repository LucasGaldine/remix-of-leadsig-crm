import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseCSV, autoMapColumns, LEAD_FIELDS, type ParsedCSV, type ColumnMapping, type LeadFieldKey } from "@/lib/csvParser";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = "upload" | "mapping" | "importing" | "done";

const SKIP_VALUE = "__skip__";

export function CSVImportModal({ open, onOpenChange, onImportComplete }: CSVImportModalProps) {
  const { user, currentAccount } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState({ success: 0, failed: 0, errors: [] as string[] });
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStep("upload");
    setCsv(null);
    setMapping({});
    setFileName("");
    setImportResult({ success: 0, failed: 0, errors: [] });
    setDragOver(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.headers.length === 0) {
        toast.error("Could not parse CSV headers");
        return;
      }

      if (parsed.rows.length === 0) {
        toast.error("CSV file has no data rows");
        return;
      }

      setCsv(parsed);
      setMapping(autoMapColumns(parsed.headers));
      setStep("mapping");
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleMappingChange = (header: string, value: string) => {
    setMapping((prev) => ({ ...prev, [header]: value === SKIP_VALUE ? "" : value as LeadFieldKey }));
  };

  const hasNameMapping = Object.values(mapping).includes("name");

  const usedFields = new Set(Object.values(mapping).filter(Boolean));

  const handleImport = async () => {
    if (!csv || !user?.id || !currentAccount) return;

    if (!hasNameMapping) {
      toast.error("You must map at least the Name field");
      return;
    }

    setStep("importing");

    const reverseMapping: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field) reverseMapping[field] = header;
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 50;
    for (let i = 0; i < csv.rows.length; i += BATCH_SIZE) {
      const batch = csv.rows.slice(i, i + BATCH_SIZE);
      const records = batch.map((row, batchIdx) => {
        const rowIdx = i + batchIdx + 2;
        const getValue = (field: string) => {
          const header = reverseMapping[field];
          if (!header) return null;
          const colIdx = csv.headers.indexOf(header);
          if (colIdx === -1) return null;
          const val = row[colIdx]?.trim();
          return val || null;
        };

        const name = getValue("name");
        if (!name) {
          errors.push(`Row ${rowIdx}: Missing name`);
          return null;
        }

        const estimatedRaw = getValue("estimated_value");
        let estimatedValue: number | null = null;
        if (estimatedRaw) {
          const cleaned = estimatedRaw.replace(/[$,]/g, "");
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) estimatedValue = parsed;
        }

        return {
          name,
          email: getValue("email"),
          phone: getValue("phone"),
          address: getValue("address"),
          city: getValue("city"),
          state: getValue("state"),
          service_type: getValue("service_type"),
          source: getValue("source") || "CSV Import",
          notes: getValue("notes"),
          estimated_value: estimatedValue,
          created_by: user.id,
          account_id: currentAccount.id,
          status: "new" as const,
          approval_status: "approved",
        };
      }).filter(Boolean);

      if (records.length > 0) {
        const { data, error } = await supabase
          .from("leads")
          .insert(records as any[])
          .select("id");

        if (error) {
          failed += records.length;
          errors.push(`Batch error: ${error.message}`);
        } else {
          success += data.length;
        }
      }

      failed += batch.length - records.length;
    }

    setImportResult({ success, failed, errors });
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Leads from CSV"}
            {step === "mapping" && "Map CSV Columns"}
            {step === "importing" && "Importing Leads..."}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file containing your leads data."}
            {step === "mapping" && "Match each CSV column to the corresponding lead field."}
            {step === "importing" && "Please wait while your leads are being imported."}
            {step === "done" && `Processed ${importResult.success + importResult.failed} rows.`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
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

        {step === "mapping" && csv && (
          <div className="flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {csv.rows.length} rows
              </span>
            </div>

            <ScrollArea className="h-[340px] pr-3">
              <div className="space-y-3">
                {csv.headers.map((header) => {
                  const currentValue = mapping[header] || "";
                  return (
                    <div key={header} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {csv.rows[0]?.[csv.headers.indexOf(header)] || "—"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={currentValue || SKIP_VALUE}
                        onValueChange={(v) => handleMappingChange(header, v)}
                      >
                        <SelectTrigger className="w-[160px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>
                            <span className="text-muted-foreground">Skip column</span>
                          </SelectItem>
                          {LEAD_FIELDS.map((field) => {
                            const taken = usedFields.has(field.key) && currentValue !== field.key;
                            return (
                              <SelectItem key={field.key} value={field.key} disabled={taken}>
                                {field.label}
                                {field.required && " *"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {!hasNameMapping && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>The Name field must be mapped to proceed.</span>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Importing your leads...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-sm">{importResult.success} leads imported</p>
                {importResult.failed > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {importResult.failed} rows skipped
                  </p>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Issues:</p>
                <ScrollArea className="max-h-[120px]">
                  <ul className="space-y-1">
                    {importResult.errors.slice(0, 20).map((err, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <X className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        {err}
                      </li>
                    ))}
                    {importResult.errors.length > 20 && (
                      <li className="text-xs text-muted-foreground">
                        ...and {importResult.errors.length - 20} more
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!hasNameMapping}>
                Import {csv?.rows.length} Leads
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { handleClose(false); onImportComplete?.(); }}>
              Done
            </Button>
          )}
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
