import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseCSV, type ParsedCSV } from "@/lib/csvParser";
import { useAuth } from "@/hooks/useAuth";
import { useCreateJob } from "@/hooks/useJobs";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { toast } from "sonner";

interface JobCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = "upload" | "mapping" | "importing" | "done";
type JobFieldKey =
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "job_name"
  | "service_type"
  | "address"
  | "city"
  | "description";
type ColumnMapping = Record<string, JobFieldKey | "">;
const SKIP_VALUE = "__skip__";

const JOB_FIELDS: { key: JobFieldKey; label: string; required?: boolean }[] = [
  { key: "customer_name", label: "Customer Name", required: true },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_phone", label: "Customer Phone" },
  { key: "job_name", label: "Job Name" },
  { key: "service_type", label: "Service Type" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "description", label: "Description" },
];

const FIELD_ALIASES: Record<JobFieldKey, string[]> = {
  customer_name: ["customer name", "client name", "name", "full name", "contact name"],
  customer_email: ["customer email", "client email", "email", "email address"],
  customer_phone: ["customer phone", "client phone", "phone", "phone number", "mobile", "cell"],
  job_name: ["job name", "project name", "job"],
  service_type: ["service type", "service", "job type", "type"],
  address: ["address", "street", "street address", "job address"],
  city: ["city", "town"],
  description: ["description", "notes", "scope", "details"],
};

function autoMapJobColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedFields = new Set<JobFieldKey>();

  for (const header of headers) {
    const normalizedHeader = header.trim().toLowerCase();
    let mapped: JobFieldKey | "" = "";

    for (const field of JOB_FIELDS) {
      const aliases = FIELD_ALIASES[field.key];
      if (aliases.includes(normalizedHeader) && !usedFields.has(field.key)) {
        mapped = field.key;
        usedFields.add(field.key);
        break;
      }
    }

    mapping[header] = mapped;
  }

  return mapping;
}

function getCombineInfo(mapping: ColumnMapping, headers: string[]) {
  const fieldToHeaders: Partial<Record<JobFieldKey, string[]>> = {};
  for (const header of headers) {
    const field = mapping[header];
    if (!field) continue;
    if (!fieldToHeaders[field]) fieldToHeaders[field] = [];
    fieldToHeaders[field]!.push(header);
  }
  return fieldToHeaders;
}

export function JobCSVImportModal({ open, onOpenChange, onImportComplete }: JobCSVImportModalProps) {
  const { user, currentAccount } = useAuth();
  const createJob = useCreateJob();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0, errors: [] as string[] });

  const rowCount = csvData?.rows.length ?? 0;
  const hasCustomerNameMapping = Object.values(mapping).includes("customer_name");
  const combineInfo = csvData ? getCombineInfo(mapping, csvData.headers) : {};

  const reset = () => {
    setStep("upload");
    setCsvData(null);
    setMapping({});
    setFileName("");
    setImporting(false);
    setDragOver(false);
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

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      if (!parsed.headers.length || !parsed.rows.length) {
        toast.error("CSV file must include headers and at least one row");
        return;
      }

      setCsvData(parsed);
      setMapping(autoMapJobColumns(parsed.headers));
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

  const handleMappingChange = (header: string, value: string) => {
    setMapping((prev) => ({ ...prev, [header]: value === SKIP_VALUE ? "" : (value as JobFieldKey) }));
  };

  const handleImport = async () => {
    if (!csvData || !user?.id || !currentAccount?.id) {
      toast.error("You must be logged in and have an account selected");
      return;
    }

    if (!hasCustomerNameMapping) {
      toast.error("You must map at least the Customer Name field");
      return;
    }

    setStep("importing");
    setImporting(true);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const fieldToHeaderIndices: Partial<Record<JobFieldKey, number[]>> = {};
    csvData.headers.forEach((header, index) => {
      const field = mapping[header];
      if (!field) return;
      if (!fieldToHeaderIndices[field]) fieldToHeaderIndices[field] = [];
      fieldToHeaderIndices[field]!.push(index);
    });

    const getValueFromRow = (row: string[], field: JobFieldKey) => {
      const indices = fieldToHeaderIndices[field];
      if (!indices || indices.length === 0) return null;
      const parts = indices.map((idx) => row[idx]?.trim()).filter(Boolean);
      return parts.length ? parts.join(" ") : null;
    };

    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      const rowNumber = i + 2;
      const customerName = getValueFromRow(row, "customer_name");

      if (!customerName) {
        errors.push(`Row ${rowNumber}: Missing customer name`);
        failed++;
        continue;
      }

      try {
        const customerEmail = getValueFromRow(row, "customer_email");
        const customerPhone = getValueFromRow(row, "customer_phone");
        const address = getValueFromRow(row, "address");
        const city = getValueFromRow(row, "city");
        const jobName = getValueFromRow(row, "job_name");
        const serviceType = getValueFromRow(row, "service_type");
        const description = getValueFromRow(row, "description");

        const { id: customerId } = await findOrCreateCustomer({
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address,
          city,
          created_by: user.id,
          account_id: currentAccount.id,
        });

        await createJob.mutateAsync({
          name: jobName || customerName,
          customer_id: customerId,
          email: customerEmail,
          phone: customerPhone,
          address: address || null,
          service_type: serviceType || null,
          description: description || null,
          status: "job",
        });

        success++;
      } catch (error) {
        console.error("Failed to import job row:", error);
        const message = error instanceof Error ? error.message : "Unknown import error";
        errors.push(`Row ${rowNumber}: ${message}`);
        failed++;
      }
    }

    setImporting(false);
    setImportResult({ success, failed, errors });
    setStep("done");

    if (!success) {
      toast.error("No jobs were imported.");
      return;
    }

    toast.success(`Imported ${success} job${success === 1 ? "" : "s"}.`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Jobs from CSV"}
            {step === "mapping" && "Map CSV Columns"}
            {step === "importing" && "Importing Jobs..."}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file containing your jobs data."}
            {step === "mapping" && "Match each CSV column to a job field before importing."}
            {step === "importing" && "Please wait while your jobs are being imported."}
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
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
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

        {step === "mapping" && csvData && (
          <div className="flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {rowCount} rows
              </span>
            </div>

            <ScrollArea className="h-[340px]">
              <div className="space-y-3 px-1 py-1">
                {csvData.headers.map((header) => {
                  const currentValue = mapping[header] || "";
                  const fieldHeaders = currentValue ? combineInfo[currentValue] : undefined;
                  const isCombined = !!fieldHeaders && fieldHeaders.length > 1;
                  const combineIndex = isCombined ? fieldHeaders.indexOf(header) + 1 : 0;
                  const fieldLabel = currentValue
                    ? JOB_FIELDS.find((field) => field.key === currentValue)?.label
                    : "";

                  return (
                    <div key={header} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {csvData.rows[0]?.[csvData.headers.indexOf(header)] || "\u2014"}
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
                            {JOB_FIELDS.map((field) => (
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

            {!hasCustomerNameMapping && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>The Customer Name field must be mapped to proceed.</span>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Importing your jobs...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-sm">{importResult.success} jobs imported</p>
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
              <Button type="button" onClick={handleImport} disabled={!hasCustomerNameMapping || importing}>
                Import {rowCount} Jobs
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
