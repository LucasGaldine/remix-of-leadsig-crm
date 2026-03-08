import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StripeConnectSettings } from "@/components/settings/StripeConnectSettings";
import { PlanGate } from "@/components/features/PlanGate";

export default function StripeSettings() {
  return (
    <PlanGate
      requiredPlan="basic"
      featureName="Stripe Payments"
      featureDescription="Accept credit card payments directly from your customers with Stripe Connect."
      backTo="/settings"
    >
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Payment Settings" showBack />

        <main className="px-4 py-4">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Stripe Connect
            </h2>
            <p className="text-sm text-muted-foreground">
              Accept credit card payments directly from your customers
            </p>
          </div>

          <StripeConnectSettings />

          <div className="mt-8 space-y-4">
            <h3 className="font-semibold text-foreground">How it works</h3>
            <div className="space-y-3">
              <div className="card-elevated rounded-lg p-4">
                <p className="font-medium text-foreground">1. Connect your account</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Link your Stripe account to accept payments. Stripe handles all identity, banking, and tax verification.
                </p>
              </div>
              <div className="card-elevated rounded-lg p-4">
                <p className="font-medium text-foreground">2. Accept payments</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Charge customers via invoices, payment links, or on-the-spot during jobs.
                </p>
              </div>
              <div className="card-elevated rounded-lg p-4">
                <p className="font-medium text-foreground">3. Get paid directly</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Funds go directly to your bank account. LeadSig never holds your money.
                </p>
              </div>
            </div>
          </div>
        </main>

        <MobileNav />
      </div>
    </PlanGate>
  );
}
