import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useQuickEstimate,
  ServiceType,
  SERVICE_LABELS,
  type Measurements,
} from "@/hooks/useQuickEstimate";

interface QuickEstimateLineItemProps {
  leadId: string;
  onApply: (name: string, quantity: string, unit: string, unitPrice: string, description: string) => void;
}

export function QuickEstimateLineItem({ leadId, onApply }: QuickEstimateLineItemProps) {
  const { calculateEstimate, getPricingRule, loading } = useQuickEstimate(leadId);
  const [open, setOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({});

  const rule = selectedService ? getPricingRule(selectedService) : null;
  const isFencing = selectedService === "fencing";
  const primaryValue = isFencing ? measurements.linearFeet : measurements.sqft;
  const hasValue = primaryValue && primaryValue > 0;
  const result = selectedService && hasValue ? calculateEstimate(selectedService, measurements) : null;

  const handleApply = () => {
    if (!result || !hasValue || !selectedService) return;
    const qty = primaryValue!;
    const unit = isFencing ? "linear ft" : "sq ft";
    const unitPrice = (result.totalMid / qty).toFixed(2);
    const label = SERVICE_LABELS[selectedService];

    onApply(
      label,
      qty.toString(),
      unit,
      unitPrice,
      `Labor: $${result.laborTotal.toLocaleString()} · Materials: $${result.materialTotal.toLocaleString()} · Range: $${result.totalLow.toLocaleString()} – $${result.totalHigh.toLocaleString()}`
    );
    setOpen(false);
    setSelectedService(null);
    setMeasurements({});
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedService(null);
    setMeasurements({});
  };

  if (loading) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground h-7 px-2"
        onClick={() => setOpen(true)}
      >
        <Calculator className="h-3.5 w-3.5" />
        Quick Estimate
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Estimate</DialogTitle>
            <DialogDescription>
              Choose a service type to auto-fill the unit price from your pricing rules.
            </DialogDescription>
          </DialogHeader>

          {!selectedService ? (
            <div className="grid grid-cols-2 gap-2 py-2">
              {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedService(key)}
                  className="p-4 rounded-lg border border-border text-left hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                >
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {key === "fencing" ? "per linear ft" : "per sq ft"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{SERVICE_LABELS[selectedService]}</div>
                  {rule && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Labor: ${rule.base_labor_rate}/{isFencing ? "lf" : "sf"} · Material: ${rule.material_rate}/{isFencing ? "lf" : "sf"}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedService(null); setMeasurements({}); }}>
                  Change
                </Button>
              </div>

              <div>
                <Label className="text-sm">{isFencing ? "Linear Feet" : "Square Footage"}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={isFencing ? "e.g. 120" : "e.g. 450"}
                  value={primaryValue ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                    setMeasurements(isFencing ? { linearFeet: val } : { sqft: val });
                  }}
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              {result && hasValue && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Breakdown</div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Labor</span>
                    <span className="text-right font-medium">${result.laborTotal.toLocaleString()}</span>
                    <span className="text-muted-foreground">Materials (incl. waste)</span>
                    <span className="text-right font-medium">${result.materialTotal.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Range</span>
                      <span className="font-bold text-primary">
                        ${result.totalLow.toLocaleString()} – ${result.totalHigh.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Unit Price (mid)</span>
                      <span className="font-semibold text-foreground">
                        ${(result.totalMid / primaryValue!).toFixed(2)} / {isFencing ? "lf" : "sf"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedService && result && hasValue && (
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleApply}>Apply to Line Item</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
