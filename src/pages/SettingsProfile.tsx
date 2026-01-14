import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";

export default function SettingsProfile() {
  const navigate = useNavigate();

  return (
    <FeaturePlaceholder
      title="Profile Settings"
      description="Manage your personal account information"
      icon={<User className="h-8 w-8 text-primary" />}
      whatItDoes={[
        "Update your name, email, and phone number",
        "Change your password securely",
        "Manage notification preferences",
        "Set your default time zone",
        "Upload a profile photo",
      ]}
      whatYouCanDoNow={[
        "Sign out and sign back in with a different account",
        "Reset your password via the login page",
        "Enable two-factor authentication in Security settings",
        "Contact support for account changes",
      ]}
      unlockInfo="Full profile management is coming in the next update."
      backTo="/settings"
      backLabel="Back to Settings"
    />
  );
}
