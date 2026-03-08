import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Trash2 } from "lucide-react";

export default function DataDeletion() {
  const { user } = useAuth();

  const handleEmailRequest = () => {
    const subject = encodeURIComponent("Data Deletion Request");
    const body = encodeURIComponent(
      `I would like to request deletion of my account and all associated data.\n\nAccount email: ${user?.email || "[your email]"}\n\nPlease confirm once the deletion is complete.`
    );
    window.open(`mailto:support@leadsig.ai?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Data Deletion"
        showBack
        showNotifications={false}
      />

      <main className="px-4 py-6 max-w-3xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: February 9, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">How to Delete Your Data</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              You have the right to request deletion of your personal data from LeadSig at any time. We offer the following methods to delete your data:
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Option 1: Delete Account from Settings</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              If you are logged in, you can delete your account directly from your Profile settings:
            </p>
            <ol className="text-sm text-foreground/90 leading-relaxed list-decimal list-inside space-y-2">
              <li>Go to <strong>Settings</strong> &gt; <strong>Profile</strong></li>
              <li>Scroll to the bottom of the page</li>
              <li>Click <strong>"Delete Account"</strong></li>
              <li>Confirm the deletion when prompted</li>
            </ol>
            <p className="text-sm text-foreground/90 leading-relaxed">
              This will permanently delete your account and all associated data, including leads, jobs, estimates, invoices, and any connected integration data.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Option 2: Email Request</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              If you are unable to access your account or prefer to submit a request via email, you can contact our support team:
            </p>
            <Button
              variant="outline"
              onClick={handleEmailRequest}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Send Deletion Request via Email
            </Button>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Send your request to{" "}
              <a href="mailto:support@leadsig.ai" className="text-primary hover:underline">
                support@leadsig.ai
              </a>{" "}
              with the subject line "Data Deletion Request" and include the email address associated with your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">What Gets Deleted</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              When you delete your account, the following data is permanently removed:
            </p>
            <ul className="text-sm text-foreground/90 leading-relaxed list-disc list-inside space-y-1">
              <li>Your profile and account information</li>
              <li>All leads and customer data</li>
              <li>Jobs, schedules, and crew assignments</li>
              <li>Estimates, invoices, and payment records</li>
              <li>Connected integrations and API keys</li>
              <li>Photos and uploaded files</li>
              <li>Notification and SMS logs</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Processing Time</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Account deletions initiated from the Settings page are processed immediately. Email-based deletion requests are processed within 7 business days. You will receive a confirmation email once your data has been deleted.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Retention After Deletion</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              After deletion, we may retain certain data as required by law or for legitimate business purposes (such as fraud prevention). Any retained data will be anonymized and cannot be used to identify you. Backup copies may persist for up to 30 days before being fully purged.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              If you have questions about data deletion, contact us at{" "}
              <a href="mailto:support@leadsig.ai" className="text-primary hover:underline">
                support@leadsig.ai
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
