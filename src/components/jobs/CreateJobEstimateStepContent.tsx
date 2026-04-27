import { Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceIntakePanel } from "@/components/voice/VoiceIntakePanel";
import { EditEstimateModal } from "@/components/payments/EditEstimateModal";
import type { VoiceEstimateParsedData } from "@/types/voiceIntake";

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
  showVoiceEstimateIntake: boolean;
  estimateEditorDraft: any;
  estimateVersionName: string;
  onShowVoiceEstimateIntake: () => void;
  onHideVoiceEstimateIntake: () => void;
  onEstimateVersionNameChange: (name: string) => void;
  onDraftChange: (payload: {
    lineItems: EstimateLineItemDraft[];
    profitMargin: string;
    surcharge: string;
    profitMode?: "percentage" | "amount";
    profitAmount?: string;
  }) => void;
  onApplyVoiceEstimateIntake: (parsed: VoiceEstimateParsedData) => void;
}

export function CreateJobEstimateStepContent({
  open,
  showVoiceEstimateIntake,
  estimateEditorDraft,
  estimateVersionName,
  onShowVoiceEstimateIntake,
  onHideVoiceEstimateIntake,
  onEstimateVersionNameChange,
  onDraftChange,
  onApplyVoiceEstimateIntake,
}: CreateJobEstimateStepContentProps) {
  return (
    <div className="space-y-4">
      {!showVoiceEstimateIntake ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="create-job-estimate-version-name">Estimate Version *</Label>
            <Input
              id="create-job-estimate-version-name"
              value={estimateVersionName}
              onChange={(event) => onEstimateVersionNameChange(event.target.value)}
              placeholder="Estimate Version"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onShowVoiceEstimateIntake}
          >
            <Mic className="h-4 w-4 mr-2" />
            Create With Voice
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Or Manually
            </p>
            <div className="h-px flex-1 bg-border" />
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
        </>
      ) : (
        <div className="space-y-3">
          <VoiceIntakePanel
            entityType="estimate"
            title="Voice Estimate Intake"
            description="Dictate estimate details. Required fields will trigger follow-up questions before values are applied."
            transcriptPlaceholder="Example: Add line items roof wash 1 each 900 and gutter flush 1 each 250..."
            variant="plain"
            onApply={(parsed) => onApplyVoiceEstimateIntake(parsed as VoiceEstimateParsedData)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onHideVoiceEstimateIntake}
          >
            Back to Manual Form
          </Button>
        </div>
      )}
    </div>
  );
}
