import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SupplierManagement() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Supplier Management"
      description="Manage your material suppliers and vendor relationships"
      icon={<Building2 className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Store supplier contact information and delivery preferences",
        "Track pricing and payment terms by supplier",
        "Organize suppliers by material category (pavers, lumber, concrete)",
        "Save notes on delivery reliability and quality",
        "Quick-send orders via email directly from the app",
      ]}
      whatYouCanDoNow={[
        "View existing suppliers in the Suppliers tab",
        "Call or email suppliers directly from supplier cards",
        "Create supply orders linked to material lists",
        "Track order status (draft, sent, confirmed, delivered)",
      ]}
      unlockInfo="Full supplier management will be available in the next update."
      backTo="/materials"
      backLabel="Back to Materials"
      alternativeAction={{
        label: "View Existing Suppliers",
        onClick: () => navigate("/materials"),
      }}
    />
  );
}
