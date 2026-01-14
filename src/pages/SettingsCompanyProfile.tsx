import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsCompanyProfile() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Company Profile"
      description="Set up your business information for estimates and invoices"
      icon={<Building2 className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Add your company name and logo",
        "Set business address and phone number",
        "Configure license and insurance information",
        "Customize estimate and invoice headers",
        "Add your business registration details",
      ]}
      whatYouCanDoNow={[
        "Use demo estimates and invoices to see the format",
        "Create material lists and supply orders",
        "Manage leads and track jobs",
        "Connect Stripe for payment processing",
      ]}
      unlockInfo="Company profile settings will be available in the next update. Your documents will automatically use this information."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
