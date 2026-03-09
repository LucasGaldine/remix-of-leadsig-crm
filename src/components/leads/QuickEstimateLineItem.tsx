import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useQuickEstimate,
  ServiceType,
  SERVICE_LABELS,
} from "@/hooks/useQuickEstimate";

interface QuickEstimateLineItemProps {
  leadId: string;
  onApply: (name: string, quantity: string, unit: string, unitPrice: string, description: string) => void;
}

export function QuickEstimateLineItem({ leadId, onApply }: QuickEstimateLineItemProps) {
  const { getPricingRule, loading } = useQuickEstimate(leadId);
  const [open, setOpen] = useState(false);

  const handleSelect = (serviceType: ServiceType) => {
    const rule = getPricingRule(serviceType);
    const label = SERVICE_LABELS[serviceType];
    const isFencing = serviceType === "fencing";
    const unit = isFencing ? "linear ft" : "sq ft";

    // Use the combined rate (labor + material) as unit price
    const laborRate = rule?.base_labor_rate ?? 0;
    const materialRate = rule?.material_rate ?? 0;
    const unitPrice = (laborRate + materialRate).toFixed(2);

    onApply(label, "", unit, unitPrice, "");
    setOpen(false);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Service Type</DialogTitle>
            <DialogDescription>
              Select a service to auto-fill the unit price from your pricing rules.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-2">
            {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([key, label]) => {
              const rule = getPricingRule(key);
              const rate = rule ? (rule.base_labor_rate + rule.material_rate).toFixed(2) : "—";
              const isFencing = key === "fencing";
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className="p-4 rounded-lg border border-border text-left hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                >
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ${rate} / {isFencing ? "lf" : "sf"}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}