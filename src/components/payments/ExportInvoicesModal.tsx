import { useState } from "react";
import { Calendar as CalendarIcon, Download, Loader as Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, subDays, startOfYear } from "date-fns";
import { ExportTarget, useFinancialExportHistory, useGenerateExport } from "@/hooks/useFinancialExports";

interface ExportInvoicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PresetKey = "this-month" | "last-month" | "last-30" | "last-90" | "ytd" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "last-30", label: "Last 30 Days" },
  { key: "last-90", label: "Last 90 Days" },
  { key: "ytd", label: "Year to Date" },
  { key: "custom", label: "Custom Range" },
];

function getPresetDates(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "this-month":
      return { from: startOfMonth(now), to: now };
    case "last-month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "last-30":
      return { from: subDays(now, 30), to: now };
    case "last-90":
      return { from: subDays(now, 90), to: now };
    case "ytd":
      return { from: startOfYear(now), to: now };
    case "custom":
      return { from: startOfMonth(now), to: now };
  }
}

export function ExportInvoicesModal({ open, onOpenChange }: ExportInvoicesModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("this-month");
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget>("csv");

  const generateExport = useGenerateExport();
  const { data: exports = [], isLoading: isLoadingHistory } = useFinancialExportHistory();
  const lastExport = exports[0];

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    if (key !== "custom") {
      const { from, to } = getPresetDates(key);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const handleExport = () => {
    generateExport.mutate(
      { dateFrom, dateTo, exportTarget },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Financial Data</DialogTitle>
          <DialogDescription>
            Select a time period and destination for your exported payment and accounting data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Destination</p>
            <Select value={exportTarget} onValueChange={(value) => setExportTarget(value as ExportTarget)}>
              <SelectTrigger aria-label="Destination">
                <SelectValue placeholder="Choose destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV File</SelectItem>
                <SelectItem value="quickbooks">QuickBooks (Payments)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Timeline</p>
            <Select value={selectedPreset} onValueChange={(value) => handlePresetChange(value as PresetKey)}>
              <SelectTrigger aria-label="Timeline">
                <SelectValue placeholder="Choose timeline" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPreset === "custom" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  From
                </label>
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateFrom, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        if (date) {
                          setDateFrom(date);
                          setFromOpen(false);
                        }
                      }}
                      disabled={(date) => date > dateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  To
                </label>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateTo, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        if (date) {
                          setDateTo(date);
                          setToOpen(false);
                        }
                      }}
                      disabled={(date) => date < dateFrom || date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">Export includes:</p>
            <ul className="text-sm text-muted-foreground space-y-0.5">
              {exportTarget === "csv" ? (
                <>
                  <li>Invoices with line item details</li>
                  <li>Payment records and methods</li>
                  <li>Customer and job information</li>
                  <li>Tax breakdown (subtotal, rate, tax amount)</li>
                  <li>Crew hours worked per job</li>
                  <li>Job costs by category (equipment, materials, labor, other)</li>
                </>
              ) : (
                <>
                  <li>Completed payments from the selected date range</li>
                  <li>Payment amount, date, and reference details</li>
                  <li>Customer mapping by name in QuickBooks</li>
                  <li>Direct sync to your connected QuickBooks company</li>
                </>
              )}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            {format(dateFrom, "MMM d, yyyy")} - {format(dateTo, "MMM d, yyyy")}
          </p>

          {!isLoadingHistory && lastExport && (
            <p className="text-xs text-muted-foreground">
              Last export: {format(parseISO(lastExport.created_at), "MMM d, yyyy 'at' h:mm a")} for{" "}
              {format(parseISO(lastExport.date_from), "MMM d")} - {format(parseISO(lastExport.date_to), "MMM d, yyyy")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={generateExport.isPending}>
            {generateExport.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {exportTarget === "quickbooks" ? "Export to QuickBooks" : "Export CSV"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
