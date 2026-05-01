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
  leadAddress?: string | null;
  leadCity?: string | null;
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
  leadAddress,
  leadCity,
  estimateVersionName,
  onEstimateVersionNameChange,
  onDraftChange,
}: CreateJobEstimateStepContentProps) {
  const draftJobAddress = typeof estimateEditorDraft?.job?.address === "string" ? estimateEditorDraft.job.address.trim() : "";
  const draftJobCity = typeof estimateEditorDraft?.job?.city === "string" ? estimateEditorDraft.job.city.trim() : "";
  const draftCustomerAddress = typeof estimateEditorDraft?.customer?.address === "string" ? estimateEditorDraft.customer.address.trim() : "";
  const draftCustomerCity = typeof estimateEditorDraft?.customer?.city === "string" ? estimateEditorDraft.customer.city.trim() : "";
  const normalizedAddress = (typeof leadAddress === "string" ? leadAddress.trim() : "") || draftJobAddress || draftCustomerAddress;
  const normalizedCity = (typeof leadCity === "string" ? leadCity.trim() : "") || draftJobCity || draftCustomerCity;
  const estimateDraftWithLocation = {
    ...estimateEditorDraft,
    job: {
      ...(estimateEditorDraft?.job || {}),
      address: normalizedAddress,
      city: normalizedCity,
    },
    customer: {
      ...(estimateEditorDraft?.customer || {}),
      address: normalizedAddress,
      city: normalizedCity,
    },
  };

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
        estimate={estimateDraftWithLocation}
        versionName={estimateVersionName}
        onVersionNameChange={onEstimateVersionNameChange}
        onSuccess={() => {}}
        embedded
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
