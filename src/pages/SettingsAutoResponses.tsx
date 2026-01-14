import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsAutoResponses() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Auto-Responses"
      description="Automate responses for missed calls and follow-ups"
      icon={<Zap className="h-8 w-8 text-primary" />}
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
  );
}
