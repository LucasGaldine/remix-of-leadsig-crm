import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditEstimateModal } from "@/components/payments/EditEstimateModal";

interface EstimateLineItemDraft {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: "equipment" | "materials" | "labor" | "other";
}

interface CreateJobEstimateStepContentProps {
  open: boolean;
  estimateEditorDraft: any;
  estimateVersionName: string;
  onEstimateVersionNameChange: (name: string) => void;
  onDraftChange: (payload: {
    lineItems: EstimateLineItemDraft[];
    profitMargin: string;
    surcharge: string;
    profitMode?: "percentage" | "amount";
    profitAmount?: string;
  }) => void;
}

export function CreateJobEstimateStepContent({
  open,
  estimateEditorDraft,
  estimateVersionName,
  onEstimateVersionNameChange,
  onDraftChange,
}: CreateJobEstimateStepContentProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-job-estimate-version-name">Price Option Label *</Label>
        <Input
          id="create-job-estimate-version-name"
          value={estimateVersionName}
          onChange={(event) => onEstimateVersionNameChange(event.target.value)}
          placeholder="Price Option Label"
        />
      </div>
      <EditEstimateModal
        open={open}
        onOpenChange={() => {}}
        estimate={estimateEditorDraft}
        versionName={estimateVersionName}
        onVersionNameChange={onEstimateVersionNameChange}
        onSuccess={() => {}}
        embedded
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
