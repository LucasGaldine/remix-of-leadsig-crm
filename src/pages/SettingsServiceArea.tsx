import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsServiceArea() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Service Area"
      description="Define the geographic areas where you provide services"
      icon={<MapPin className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Draw your service area on a map",
        "Set multiple service zones with different rates",
        "Auto-qualify leads based on location",
        "Flag out-of-area leads for review",
        "Calculate travel fees for distant jobs",
      ]}
      whatYouCanDoNow={[
        "Review lead locations manually in lead details",
        "Use lead qualification to mark outside_area leads",
        "Add location notes to jobs",
        "Filter leads by city in the Leads tab",
      ]}
      unlockInfo="Service area mapping will help you automatically filter and qualify leads based on location."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
