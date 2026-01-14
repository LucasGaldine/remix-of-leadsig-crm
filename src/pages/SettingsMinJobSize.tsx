import { DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsMinJobSize() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Minimum Job Size"
      description="Set your floor for project values"
      icon={<DollarSign className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Set a minimum project value threshold",
        "Auto-flag leads below your minimum",
        "Show low-budget warning during qualification",
        "Filter dashboard stats by qualified opportunities",
        "Track conversion rates above vs below threshold",
      ]}
      whatYouCanDoNow={[
        "Manually qualify leads based on budget in lead details",
        "Use 'low_budget' disqualification reason for small projects",
        "View estimated budget on lead cards",
        "Sort leads by estimated value",
      ]}
      unlockInfo="Common minimums for landscaping: $2,500 for maintenance, $5,000 for hardscape, $15,000+ for full projects."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
