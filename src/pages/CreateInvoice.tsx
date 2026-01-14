import { DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function CreateInvoice() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Create Invoice"
      description="Bill customers and track payments for completed work"
      icon={<DollarSign className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Create invoices from accepted estimates or from scratch",
        "Add line items for labor, materials, and extras",
        "Set payment terms and due dates",
        "Accept deposits (typically 30-50% for landscaping projects)",
        "Track partial payments and outstanding balances",
        "Send payment reminders automatically",
      ]}
      whatYouCanDoNow={[
        "View existing demo invoices in the Payments tab",
        "Track invoice statuses (sent, viewed, partial, paid, overdue)",
        "Use Charge Now to collect payments via Stripe",
        "Review payment history in the Charge tab",
      ]}
      unlockInfo="Full invoice creation will be available in the next update."
      backTo="/payments"
      backLabel="Back to Payments"
      ctaLabel="Charge Payment Now"
      ctaAction={() => navigate("/payments/charge")}
      alternativeAction={{
        label: "View Existing Invoices",
        onClick: () => navigate("/payments"),
      }}
    />
  );
}
