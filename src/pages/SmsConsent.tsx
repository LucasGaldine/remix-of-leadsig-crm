import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SmsConsent() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="SMS Consent" showBack showNotifications={false} />

      <main className="px-4 py-6 max-w-3xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: April 9, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">How SMS Consent Works</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              LeadSig collects SMS consent through an explicit yes/no consent control during signup and in profile settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Opt-In Disclosure</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              By providing your mobile number and opting in, you agree to receive SMS messages from LeadSig regarding appointments, estimates, service updates, and account notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Opt-Out and Revocation</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              You can revoke consent anytime by replying STOP to an SMS message or by updating SMS consent in your profile settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Handling</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              SMS opt-in data and consent will not be sold or shared with third parties or affiliates for marketing purposes.
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              For more details, review our <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
