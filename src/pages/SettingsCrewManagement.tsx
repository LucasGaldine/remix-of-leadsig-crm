import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsCrewManagement() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Crew Management"
      description="Manage your teams and job assignments"
      icon={<Users className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Add crew members with roles (crew lead, laborer, driver)",
        "Assign crews to specific jobs",
        "Track crew availability and schedules",
        "Set hourly rates per crew member",
        "Send job details and directions to crew leads",
      ]}
      whatYouCanDoNow={[
        "Assign crew leads to jobs in job details",
        "View crew lead info on job cards",
        "Track job progress and status updates",
        "Use notes to communicate job specifics",
      ]}
      unlockInfo="Full crew management will let you coordinate teams across multiple simultaneous projects."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
