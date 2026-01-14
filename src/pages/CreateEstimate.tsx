import { FileText, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function CreateEstimate() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Create Estimate"
      description="Build professional estimates for your landscaping projects"
      icon={<FileText className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Create itemized estimates with labor and materials",
        "Apply landscaping-specific templates (pavers, decks, fencing)",
        "Calculate tax and discounts automatically",
        "Send estimates via email or text to customers",
        "Track when customers view and accept estimates",
      ]}
      whatYouCanDoNow={[
        "View existing demo estimates in the Payments tab",
        "Track estimate statuses (sent, viewed, accepted)",
        "Convert accepted estimates to invoices (coming soon)",
        "Use the Jobs tab to track project progress",
      ]}
      unlockInfo="Full estimate creation will be available in the next update. You'll be notified when it's ready."
      backTo="/payments"
      backLabel="Back to Payments"
      alternativeAction={{
        label: "View Existing Estimates",
        onClick: () => navigate("/payments"),
      }}
    />
  );
}
