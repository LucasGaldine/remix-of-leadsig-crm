import { Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onShowVoiceEstimateIntake}
          >
            <Mic className="h-4 w-4 mr-2" />
            Voice Estimate Intake
          </Button>
          <EditEstimateModal
            open={open}
            onOpenChange={() => {}}
            estimate={estimateEditorDraft}
            versionName={estimateVersionName}
            showVersionNameField
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
