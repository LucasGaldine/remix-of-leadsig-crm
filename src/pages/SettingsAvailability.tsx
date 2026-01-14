import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsAvailability() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Availability Settings"
      description="Manage your working hours and blocked dates"
      icon={<Calendar className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Set your regular working hours (e.g., 7 AM - 5 PM)",
        "Block off holidays and vacation days",
        "Set seasonal availability changes",
        "Sync with your calendar for conflicts",
        "Allow customers to request appointments in open slots",
      ]}
      whatYouCanDoNow={[
        "Use the Schedule tab to view and manage jobs",
        "Manually schedule jobs for specific dates and times",
        "See daily job overview on the dashboard",
        "Track crew lead assignments per job",
      ]}
      unlockInfo="Availability settings will help automate scheduling and prevent double-booking."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
