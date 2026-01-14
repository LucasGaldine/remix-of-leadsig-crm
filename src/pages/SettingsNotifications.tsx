import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsNotifications() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Notification Settings"
      description="Configure push and SMS notification preferences"
      icon={<Bell className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Choose notification types (new leads, payments, schedule changes)",
        "Set quiet hours for after-work notifications",
        "Enable SMS alerts for urgent items",
        "Get push notifications on mobile",
        "Configure email digest frequency",
      ]}
      whatYouCanDoNow={[
        "See notification count on dashboard",
        "Review pending leads and approvals daily",
        "Check payment status in the Payments tab",
        "Monitor job schedule on the Schedule page",
      ]}
      unlockInfo="Push and SMS notifications will help you never miss an important lead or payment."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
