import { useState } from "react";
import { Check, X, Crown, Zap, Leaf } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PlanKey = "free" | "basic" | "premium";

const planOrder: Record<PlanKey, number> = { free: 0, basic: 1, premium: 2 };

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  features: PlanFeature[];
  highlighted?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with basic lead storage and tracking.",
    icon: <Leaf className="h-6 w-6" />,
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
    key: "basic",
    name: "Basic",
    price: "$500",
    period: "/month",
    description: "Connect your tools and stay informed with real-time alerts.",
    icon: <Zap className="h-6 w-6" />,
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
    key: "premium",
    name: "Premium",
    price: "$3,000",
    period: "/month",
    description: "Full automation, auto-replies, and we bring you leads.",
    icon: <Crown className="h-6 w-6" />,
    highlighted: true,
    badge: "Most Popular",
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

function PlanCard({
  plan,
  isCurrent,
  currentPlan,
  onChangePlan,
  isUpdating,
}: {
  plan: Plan;
  isCurrent: boolean;
  currentPlan: PlanKey;
  onChangePlan: (newPlan: PlanKey) => void;
  isUpdating: boolean;
}) {
  const isDowngrade = planOrder[plan.key] < planOrder[currentPlan];

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 transition-shadow",
        isCurrent
          ? "border-primary shadow-lg ring-1 ring-primary/20"
          : "border-border shadow-sm"
      )}
    >
      {isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs">
          Current Plan
        </Badge>
      )}
      {!isCurrent && plan.badge && (
        <Badge
          variant="outline"
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-card px-3 py-0.5 text-xs"
        >
          {plan.badge}
        </Badge>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "rounded-lg p-2",
            isCurrent
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

      {isCurrent ? (
        <Button variant="outline" className="w-full" disabled>
          Current Plan
        </Button>
      ) : (
        <Button
          variant={isDowngrade ? "outline" : "default"}
          className={cn("w-full", plan.highlighted && !isDowngrade && "shadow-sm")}
          onClick={() => onChangePlan(plan.key)}
          disabled={isUpdating}
        >
          {isDowngrade ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`}
        </Button>
      )}
    </div>
  );
}

export default function SettingsPricing() {
  const { currentAccount, refreshProfile } = useAuth();
  const currentPlan: PlanKey = currentAccount?.pricing_plan ?? "free";
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);

  const isDowngrade = pendingPlan ? planOrder[pendingPlan] < planOrder[currentPlan] : false;
  const pendingPlanName = pendingPlan
    ? plans.find((p) => p.key === pendingPlan)?.name
    : "";

  const handleChangePlan = async () => {
    if (!pendingPlan || !currentAccount) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from("accounts")
      .update({ pricing_plan: pendingPlan })
      .eq("id", currentAccount.id);

    if (error) {
      toast.error("Failed to update plan. Please try again.");
    } else {
      toast.success(`Plan updated to ${pendingPlanName}.`);
      await refreshProfile();
    }

    setIsUpdating(false);
    setPendingPlan(null);
  };

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
              {currentAccount?.company_name
                ? `${currentAccount.company_name} is on the ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan.`
                : "Scale your operations with the tools and support you need."}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === currentPlan}
                currentPlan={currentPlan}
                onChangePlan={setPendingPlan}
                isUpdating={isUpdating}
              />
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

      <AlertDialog open={!!pendingPlan} onOpenChange={() => setPendingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDowngrade ? "Downgrade" : "Upgrade"} to {pendingPlanName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDowngrade
                ? `Your company will be moved to the ${pendingPlanName} plan. Some features may no longer be available.`
                : `Your company will be upgraded to the ${pendingPlanName} plan with access to additional features.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangePlan} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
