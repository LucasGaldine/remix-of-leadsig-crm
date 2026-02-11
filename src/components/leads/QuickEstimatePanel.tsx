import { useState, useEffect, useCallback } from "react";
import { Calculator, ChevronDown, ChevronUp, Save, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useQuickEstimate,
  ServiceType,
  SERVICE_LABELS,
  Measurements,
  QuickEstimateResult
} from "@/hooks/useQuickEstimate";

export interface QuickEstimateBreakdown {
  serviceType: ServiceType;
  measurements: Measurements;
  result: QuickEstimateResult;
}

interface QuickEstimatePanelProps {
  leadId: string;
  hasAddress?: boolean;
  onEstimateSaved?: () => void;
  onCreateDraft?: (breakdown: QuickEstimateBreakdown) => void;
  onSaveToEstimate?: (breakdown: QuickEstimateBreakdown) => void;
  variant?: "collapsible" | "flat";
  className?: string;
}

export function QuickEstimatePanel({
  leadId,
  hasAddress = true,
  onEstimateSaved,
  onCreateDraft,
  onSaveToEstimate,
  variant = "collapsible",
  className,
}: QuickEstimatePanelProps) {
  const { calculateEstimate, saveQuickEstimate, loading, saving } = useQuickEstimate(leadId);
  
  const [isOpen, setIsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  const [serviceType, setServiceType] = useState<ServiceType>("pavers");
  const [measurements, setMeasurements] = useState<Measurements>({
    sqft: undefined,
    linearFeet: undefined,
    depth: undefined,
    height: undefined,
  });
  const [notes, setNotes] = useState("");
  
  const [result, setResult] = useState<QuickEstimateResult | null>(null);

  // Recalculate on measurement or service type change
  useEffect(() => {
    const hasValue = serviceType === "fencing" 
      ? (measurements.linearFeet && measurements.linearFeet > 0)
      : (measurements.sqft && measurements.sqft > 0);
    
    if (hasValue) {
      const calculated = calculateEstimate(serviceType, measurements);
      setResult(calculated);
    } else {
      setResult(null);
    }
  }, [serviceType, measurements, calculateEstimate]);

  const handleServiceChange = (value: ServiceType) => {
    setServiceType(value);
    // Reset measurements when changing service type
    setMeasurements({
      sqft: undefined,
      linearFeet: undefined,
      depth: undefined,
      height: undefined,
    });
    setResult(null);
  };

  const handleMeasurementChange = (field: keyof Measurements, value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    setMeasurements((prev) => ({ ...prev, [field]: numValue }));
  };

  const handleSave = async () => {
    if (!result) return;
    
    const saved = await saveQuickEstimate(serviceType, measurements, result, notes);
    if (saved) {
      onEstimateSaved?.();
      // Reset form
      setMeasurements({ sqft: undefined, linearFeet: undefined, depth: undefined, height: undefined });
      setNotes("");
      setResult(null);
    }
  };

  const handleConvert = async () => {
    if (!result) return;

    await saveQuickEstimate(serviceType, measurements, result, notes);
    onCreateDraft?.({ serviceType, measurements, result });
  };

  const isFencing = serviceType === "fencing";
  const primaryMeasurement = isFencing ? measurements.linearFeet : measurements.sqft;
  const hasValidInput = primaryMeasurement && primaryMeasurement > 0;

  const handleSaveToEstimate = async () => {
    if (!result) return;
    await saveQuickEstimate(serviceType, measurements, result, notes);
    onSaveToEstimate?.({ serviceType, measurements, result });
  };

  const formContent = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <>
      <div>
        <Label htmlFor="service-type">Service Type</Label>
        <Select value={serviceType} onValueChange={(v) => handleServiceChange(v as ServiceType)}>
          <SelectTrigger id="service-type" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SERVICE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="primary-measurement">
            {isFencing ? "Linear Feet" : "Square Footage"}
          </Label>
          <Input
            id="primary-measurement"
            type="number"
            inputMode="decimal"
            placeholder={isFencing ? "e.g. 120" : "e.g. 450"}
            value={primaryMeasurement ?? ""}
            onChange={(e) => handleMeasurementChange(
              isFencing ? "linearFeet" : "sqft",
              e.target.value
            )}
            className="mt-1.5 text-lg h-12"
          />
        </div>

        {(serviceType === "concrete" || serviceType === "pavers") && (
          <div>
            <Label htmlFor="depth">Depth (inches, optional)</Label>
            <Input
              id="depth"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 4"
              value={measurements.depth ?? ""}
              onChange={(e) => handleMeasurementChange("depth", e.target.value)}
              className="mt-1.5"
            />
          </div>
        )}

        {serviceType === "fencing" && (
          <div>
            <Label htmlFor="height">Fence Height (ft, optional)</Label>
            <Input
              id="height"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 6"
              value={measurements.height ?? ""}
              onChange={(e) => handleMeasurementChange("height", e.target.value)}
              className="mt-1.5"
            />
          </div>
        )}

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special considerations..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1.5"
          />
        </div>
      </div>

      {result && hasValidInput && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="bg-accent/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Estimated Range</p>
            <p className="text-2xl font-bold text-primary">
              ${result.totalLow.toLocaleString()} – ${result.totalHigh.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Mid: ${result.totalMid.toLocaleString()}
            </p>
          </div>

          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {showBreakdown ? "Hide" : "Show"} breakdown
            {showBreakdown ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showBreakdown && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor</span>
                <span className="font-medium">${result.laborTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materials (w/ waste)</span>
                <span className="font-medium">${result.materialTotal.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted-foreground">+ Overhead & Margin</span>
                <span className="font-medium">
                  ${(result.totalMid - result.laborTotal - result.materialTotal).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center italic">
            Rough estimate. Final pricing may change after material selection.
          </p>

          <div className="flex gap-2 pt-2">
            {onSaveToEstimate ? (
              <Button
                className="flex-1"
                onClick={handleSaveToEstimate}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save to Estimate
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConvert}
                  disabled={saving || !hasAddress}
                  title={!hasAddress ? "Add an address to create an estimate" : undefined}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Create Draft
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {!hasValidInput && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Enter measurements to see estimate
        </div>
      )}
    </>
  );

  if (variant === "flat") {
    return <div className={cn("space-y-4", className)}>{formContent}</div>;
  }

  return (
    <div className={cn("card-elevated rounded-lg", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-accent/50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Quick Estimate</h3>
                <p className="text-sm text-muted-foreground">On-site rough pricing</p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">{formContent}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
