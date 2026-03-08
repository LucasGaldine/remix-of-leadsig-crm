import { Zap } from "lucide-react";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { PlanGate } from "@/components/features/PlanGate";

export default function SettingsAutoResponses() {
  return (
    <PlanGate
      requiredPlan="premium"
      featureName="Auto-Responses"
      featureDescription="Automate responses for missed calls and follow-ups. Send automatic texts within minutes so you never lose a lead."
      backTo="/settings"
    >
      <FeaturePlaceholder
        title="Auto-Responses"
        description="Automate responses for missed calls and follow-ups"
        icon={<Zap className="h-8 w-8 text-amber-500" />}
        isPremium
        whatItDoes={[
          "Send automatic texts when you miss a call",
          "Schedule follow-up reminders for cold leads",
          "Send confirmation texts when appointments are booked",
          "Auto-reply to new lead inquiries",
          "Set business hours for delayed responses",
        ]}
        whatYouCanDoNow={[
          "Manually log calls and texts in lead interactions",
          "Track all lead communications in the timeline",
          "Use status changes to mark follow-up needed",
          "Set up email notifications for new leads",
        ]}
        unlockInfo="Auto-responses help you respond within 5 minutes—when leads are most likely to book."
        backTo="/settings"
        backLabel="Back to Settings"
      />
    </PlanGate>
  );
}
