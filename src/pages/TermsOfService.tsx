import { PageHeader } from "@/components/layout/PageHeader";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Terms of Service"
        showBack
        showNotifications={false}
      />

      <main className="px-4 py-6 max-w-3xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: February 9, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              By accessing or using LeadSig ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Description of Service</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              LeadSig is a customer relationship management (CRM) platform designed for service businesses. The Service includes lead management, scheduling, estimates, invoicing, payment processing, and integrations with third-party platforms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Account Registration</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Acceptable Use</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">You agree not to:</p>
            <ul className="text-sm text-foreground/90 leading-relaxed list-disc list-inside space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload malicious content or attempt to compromise the platform</li>
              <li>Interfere with other users' access to the Service</li>
              <li>Attempt to reverse engineer or decompile any part of the Service</li>
              <li>Use the Service to send unsolicited communications (spam)</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Data Ownership</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              You retain ownership of all data you input into the Service. By using the Service, you grant us a limited license to process your data solely for the purpose of providing and improving the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Third-Party Integrations</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              The Service may integrate with third-party platforms (Facebook, Google, Stripe, etc.). Your use of those platforms is subject to their respective terms and policies. We are not responsible for the availability, accuracy, or practices of third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Payment Terms</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Certain features of the Service may require a paid subscription. Subscription fees are billed in advance on a recurring basis. You may cancel your subscription at any time, and cancellation will take effect at the end of the current billing period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Service Availability</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or modifications that temporarily affect availability. We will make reasonable efforts to notify you in advance of planned downtime.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Limitation of Liability</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              To the maximum extent permitted by law, LeadSig shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Disclaimer of Warranties</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Termination</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We reserve the right to suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service ceases immediately. You may request export of your data within 30 days of termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">12. Changes to Terms</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We may modify these Terms at any time. Material changes will be communicated via email or through the Service. Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">13. Governing Law</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">14. Contact</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              For questions about these Terms, contact us at{" "}
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
