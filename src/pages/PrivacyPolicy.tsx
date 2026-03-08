import { PageHeader } from "@/components/layout/PageHeader";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Privacy Policy"
        showBack
        showNotifications={false}
      />

      <main className="px-4 py-6 max-w-3xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: February 9, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Introduction</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              LeadSig ("we," "our," or "us") operates the LeadSig CRM platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Information We Collect</h2>
            <h3 className="text-base font-medium">Personal Information</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">
              When you create an account, we collect information such as your name, email address, phone number, and business details. If you connect payment processing, we collect information necessary to facilitate transactions.
            </p>
            <h3 className="text-base font-medium">Lead Data</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We process lead information that you import or receive through connected platforms (such as Facebook, Google, Angi, Yelp, and Thumbtack). This may include names, contact details, service requests, and location information of your potential customers.
            </p>
            <h3 className="text-base font-medium">Usage Data</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We automatically collect certain information when you access our platform, including your IP address, browser type, device information, and usage patterns.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
            <ul className="text-sm text-foreground/90 leading-relaxed list-disc list-inside space-y-1">
              <li>To provide, maintain, and improve our CRM services</li>
              <li>To process leads and facilitate communication with your customers</li>
              <li>To process payments and manage billing</li>
              <li>To send you service-related notifications</li>
              <li>To provide customer support</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Data Sharing</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="text-sm text-foreground/90 leading-relaxed list-disc list-inside space-y-1">
              <li>Service providers who assist in operating our platform (hosting, payment processing, analytics)</li>
              <li>Third-party integrations you explicitly connect (Facebook, Stripe, etc.)</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Data Security</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Data Retention</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time through the Data Deletion page or by contacting support.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Your Rights</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul className="text-sm text-foreground/90 leading-relaxed list-disc list-inside space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Request data portability</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Cookies</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We use essential cookies and local storage to maintain your session and preferences. We do not use third-party tracking cookies for advertising purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Children's Privacy</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Our service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Contact Us</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at{" "}
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
