import { Check, X, Crown, Zap, Leaf } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  features: PlanFeature[];
  highlighted?: boolean;
  badge?: string;
  buttonLabel: string;
  buttonVariant: "default" | "outline";
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with basic lead storage and tracking.",
    icon: <Leaf className="h-6 w-6" />,
    buttonLabel: "Current Plan",
    buttonVariant: "outline",
    features: [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking", included: true },
      { label: "Basic scheduling", included: true },
      { label: "Integrations", included: false },
      { label: "Automations & auto-replies", included: false },
      { label: "SMS & email notifications", included: false },
      { label: "LeadSig lead generation", included: false },
    ],
  },
  {
    name: "Basic",
    price: "$500",
    period: "/month",
    description: "Connect your tools and stay informed with real-time alerts.",
    icon: <Zap className="h-6 w-6" />,
    buttonLabel: "Upgrade to Basic",
    buttonVariant: "default",
    features: [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking", included: true },
      { label: "Basic scheduling", included: true },
      { label: "Integrations", included: true },
      { label: "SMS & email notifications", included: true },
      { label: "Automations & auto-replies", included: false },
      { label: "LeadSig lead generation", included: false },
    ],
  },
  {
    name: "Premium",
    price: "$3,000",
    period: "/month",
    description: "Full automation, auto-replies, and we bring you leads.",
    icon: <Crown className="h-6 w-6" />,
    highlighted: true,
    badge: "Most Popular",
    buttonLabel: "Upgrade to Premium",
    buttonVariant: "default",
    features: [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking", included: true },
      { label: "Basic scheduling", included: true },
      { label: "Integrations", included: true },
      { label: "SMS & email notifications", included: true },
      { label: "Automations & auto-replies", included: true },
      { label: "LeadSig lead generation", included: true },
    ],
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 transition-shadow",
        plan.highlighted
          ? "border-primary shadow-lg ring-1 ring-primary/20"
          : "border-border shadow-sm"
      )}
    >
      {plan.badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs">
          {plan.badge}
        </Badge>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "rounded-lg p-2",
            plan.highlighted
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {plan.icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {plan.price}
        </span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </div>

      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        {plan.description}
      </p>

      <div className="mb-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <div key={feature.label} className="flex items-center gap-2.5">
            {feature.included ? (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <X className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span
              className={cn(
                "text-sm",
                feature.included
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              )}
            >
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      <Button
        variant={plan.buttonVariant}
        className={cn("w-full", plan.highlighted && "shadow-sm")}
        disabled={plan.name === "Free"}
      >
        {plan.buttonLabel}
      </Button>
    </div>
  );
}

export default function SettingsPricing() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Pricing Plans" showBack />

      <main className="px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Choose the right plan for your business
            </h2>
            <p className="mt-2 text-muted-foreground">
              Scale your operations with the tools and support you need.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>

          <div className="mt-8 rounded-lg border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Need a custom plan or have questions?{" "}
              <a
                href="mailto:support@leadsig.ai?subject=Custom Plan Inquiry"
                className="font-medium text-primary hover:underline"
              >
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
