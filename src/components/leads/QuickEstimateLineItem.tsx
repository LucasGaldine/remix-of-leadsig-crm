import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const { calculateEstimate, loading } = useQuickEstimate(leadId);
  const [isOpen, setIsOpen] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("pavers");
  const [measurements, setMeasurements] = useState<Measurements>({});

  const isFencing = serviceType === "fencing";
  const primaryValue = isFencing ? measurements.linearFeet : measurements.sqft;
  const hasValue = primaryValue && primaryValue > 0;

  const result = hasValue ? calculateEstimate(serviceType, measurements) : null;

  const handleApply = () => {
    if (!result || !hasValue) return;

    const qty = primaryValue!;
    const unit = isFencing ? "linear ft" : "sq ft";
    const unitPrice = (result.totalMid / qty).toFixed(2);
    const label = SERVICE_LABELS[serviceType];

    onApply(
      label,
      qty.toString(),
      unit,
      unitPrice,
      `Labor: $${result.laborTotal.toLocaleString()} · Materials: $${result.materialTotal.toLocaleString()} · Range: $${result.totalLow.toLocaleString()} – $${result.totalHigh.toLocaleString()}`
    );
    setIsOpen(false);
    setMeasurements({});
  };

  if (loading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
          <Calculator className="h-3.5 w-3.5" />
          Quick Estimate
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-3 rounded-lg border border-dashed border-border bg-muted/30 space-y-3">
          <div>
            <Label className="text-xs">Service Type</Label>
            <Select value={serviceType} onValueChange={(v) => { setServiceType(v as ServiceType); setMeasurements({}); }}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">{isFencing ? "Linear Feet" : "Square Footage"}</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={isFencing ? "e.g. 120" : "e.g. 450"}
              value={primaryValue ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                setMeasurements(isFencing ? { linearFeet: val } : { sqft: val });
              }}
              className="h-8 text-sm mt-1"
            />
          </div>

          {result && hasValue && (
            <div className="space-y-2">
              <div className="bg-accent/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Estimated Range</p>
                <p className="text-sm font-bold text-primary">
                  ${result.totalLow.toLocaleString()} – ${result.totalHigh.toLocaleString()}
                </p>
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleApply}>
                Apply to Line Item
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
