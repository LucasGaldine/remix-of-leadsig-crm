import { useEffect, useMemo, useState } from "react";
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
import {
  BASIC_TIER_CONFIG,
  getBasicTierMonthlyPrice,
  getBasicTierSeatLabel,
  hasLandscapingSkoolAccess,
  type BasicTier,
  type PlanKey,
} from "@/lib/billingPlans";

const planOrder: Record<PlanKey, number> = { free: 0, basic: 1, premium: 2 };

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  key: PlanKey;
  name: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    period: "/month",
    description: "Get started with basic lead storage and tracking.",
    icon: <Leaf className="h-6 w-6" />,
  },
  {
    key: "basic",
    name: "Basic",
    period: "/month",
    description: "Tiered pricing for growing teams with automation-ready workflows.",
    icon: <Zap className="h-6 w-6" />,
  },
  {
    key: "premium",
    name: "Premium",
    period: "/month",
    description: "Full automation, lead generation support, and premium onboarding.",
    icon: <Crown className="h-6 w-6" />,
    highlighted: true,
    badge: "Most Popular",
  },
];

function getPlanFeatures(plan: PlanKey, basicTier: BasicTier): PlanFeature[] {
  const skoolIncluded = hasLandscapingSkoolAccess(plan, plan === "basic" ? basicTier : null);

  if (plan === "free") {
    return [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking", included: true },
      { label: "Basic scheduling", included: true },
      { label: "Before photos on leads", included: false },
      { label: "Integrations", included: false },
      { label: "Automations & auto-replies", included: false },
      { label: "SMS & email notifications", included: false },
      { label: "Landscaping Skool", included: false },
      { label: "LeadSig lead generation", included: false },
    ];
  }

  if (plan === "basic") {
    return [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking", included: true },
      { label: "Basic scheduling", included: true },
      { label: "Before photos on leads", included: true },
      { label: "Integrations", included: true },
      { label: "SMS & email notifications", included: true },
      { label: "Automations & auto-replies", included: false },
      { label: "Landscaping Skool (Growth tier)", included: skoolIncluded },
      { label: "LeadSig lead generation", included: false },
    ];
  }

  return [
    { label: "Lead storage & management", included: true },
    { label: "Job tracking", included: true },
    { label: "Basic scheduling", included: true },
    { label: "Before photos on leads", included: true },
    { label: "Integrations", included: true },
    { label: "SMS & email notifications", included: true },
    { label: "Automations & auto-replies", included: true },
    { label: "Landscaping Skool", included: skoolIncluded },
    { label: "LeadSig lead generation", included: true },
  ];
}

function getPlanPrice(plan: PlanKey, basicTier: BasicTier): string {
  const formatPrice = (value: number) => `$${value.toLocaleString("en-US")}`;

  if (plan === "free") {
    return formatPrice(0);
  }

  if (plan === "basic") {
    return formatPrice(getBasicTierMonthlyPrice(basicTier));
  }

  return formatPrice(497);
}

function getBasicTierDisplayName(tier: BasicTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function PlanCard({
  plan,
  isCurrent,
  currentPlan,
  onChangePlan,
  isUpdating,
  selectedBasicTier,
  onSelectBasicTier,
  currentTier,
}: {
  plan: Plan;
  isCurrent: boolean;
  currentPlan: PlanKey;
  onChangePlan: (newPlan: PlanKey) => void;
  isUpdating: boolean;
  selectedBasicTier: BasicTier;
  onSelectBasicTier: (tier: BasicTier) => void;
  currentTier: BasicTier | null;
}) {
  const isDowngrade = planOrder[plan.key] < planOrder[currentPlan];
  const isCurrentBasicPlan = plan.key === "basic" && currentPlan === "basic";
  const displayTier = selectedBasicTier;
  const isBasicTierChange = isCurrentBasicPlan && currentTier !== null && displayTier !== currentTier;
  const isCurrentSelection = isCurrent && !isBasicTierChange;
  const isBasicTierDowngrade = isCurrentBasicPlan
    && currentTier !== null
    && getBasicTierMonthlyPrice(displayTier) < getBasicTierMonthlyPrice(currentTier);
  const features = getPlanFeatures(plan.key, displayTier);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 transition-shadow",
        isCurrentSelection
          ? "border-primary shadow-lg ring-1 ring-primary/20"
          : "border-border shadow-sm"
      )}
    >
      {isCurrentSelection && (
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

      {plan.key === "basic" && (
        <label className="mb-4 block text-sm text-muted-foreground">
          Tier
          <select
            aria-label="Basic tier"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            value={displayTier}
            onChange={(event) => onSelectBasicTier(event.target.value as BasicTier)}
            disabled={isUpdating}
          >
            {Object.keys(BASIC_TIER_CONFIG).map((tier) => (
              <option key={tier} value={tier}>
                {getBasicTierDisplayName(tier as BasicTier)} ({getBasicTierSeatLabel(tier as BasicTier)}) - ${getBasicTierMonthlyPrice(tier as BasicTier)}/mo
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {getPlanPrice(plan.key, displayTier)}
        </span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </div>

      {plan.key === "premium" && (
        <p className="mb-2 text-xs text-muted-foreground">+ $3,000 one-time setup fee</p>
      )}

      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        {plan.description}
      </p>

      <div className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
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

      {isCurrentSelection ? (
        <Button variant="outline" className="w-full" disabled>
          Current Plan
        </Button>
      ) : (
        <Button
          variant={isDowngrade || isBasicTierDowngrade ? "outline" : "default"}
          className={cn(
            "w-full",
            plan.highlighted && !isDowngrade && !isBasicTierDowngrade && "shadow-sm",
          )}
          onClick={() => onChangePlan(plan.key)}
          disabled={isUpdating}
        >
          {isCurrentBasicPlan
            ? `Switch to ${getBasicTierDisplayName(displayTier)}`
            : isDowngrade
              ? `Downgrade to ${plan.name}`
              : `Upgrade to ${plan.name}`}
        </Button>
      )}
    </div>
  );
}

export default function SettingsPricing() {
  const { currentAccount, refreshProfile } = useAuth();
  const currentPlan: PlanKey = (currentAccount?.pricing_plan as PlanKey) ?? "free";
  const currentTier: BasicTier | null = (currentAccount as { pricing_tier?: BasicTier | null } | null)?.pricing_tier ?? null;

  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [selectedBasicTier, setSelectedBasicTier] = useState<BasicTier>(currentTier ?? "solo");
  const [onboardingTrialDays, setOnboardingTrialDays] = useState<number>(0);

  useEffect(() => {
    if (currentTier) {
      setSelectedBasicTier(currentTier);
    }
  }, [currentTier]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const onboarding = url.searchParams.get("onboarding") === "1";
    const trialValue = Number(url.searchParams.get("trial") || "0");
    setOnboardingTrialDays(onboarding && Number.isFinite(trialValue) ? Math.max(0, trialValue) : 0);

    const defaultPlan = url.searchParams.get("defaultPlan");
    if (onboarding && defaultPlan === "basic") {
      setPendingPlan("basic");
    }

    const billingStatus = url.searchParams.get("billing");
    if (!billingStatus) {
      return;
    }

    if (billingStatus === "success") {
      toast.success("Stripe checkout completed. Your plan will refresh shortly.");
      refreshProfile();
    } else if (billingStatus === "canceled") {
      toast.error("Stripe checkout was canceled.");
    }

    url.searchParams.delete("billing");
    window.history.replaceState({}, "", url.toString());
  }, [refreshProfile]);

  const isDowngrade = pendingPlan ? planOrder[pendingPlan] < planOrder[currentPlan] : false;
  const isBasicTierChange = pendingPlan === "basic"
    && currentPlan === "basic"
    && currentTier !== null
    && selectedBasicTier !== currentTier;
  const pendingAction = isBasicTierChange ? "Change tier" : isDowngrade ? "Downgrade" : "Upgrade";
  const pendingPlanName = pendingPlan
    ? plans.find((p) => p.key === pendingPlan)?.name
    : "";

  const pendingTier: BasicTier | null = useMemo(() => {
    if (pendingPlan !== "basic") {
      return null;
    }
    return selectedBasicTier;
  }, [pendingPlan, selectedBasicTier]);

  const handleChangePlan = async () => {
    if (!pendingPlan || !currentAccount) return;

    setIsUpdating(true);

    const { data, error } = await supabase.functions.invoke("stripe-manage-subscription", {
      body: {
        accountId: currentAccount.id,
        targetPlan: pendingPlan,
        targetTier: pendingTier,
        trialDays: pendingPlan === "basic" && onboardingTrialDays > 0 ? onboardingTrialDays : 0,
        returnUrl: `${window.location.origin}/settings/pricing`,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to update plan. Please try again.");
      setIsUpdating(false);
      return;
    }

    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    toast.success(data?.message || `Plan updated to ${pendingPlanName}.`);
    await refreshProfile();

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

          {onboardingTrialDays > 0 && (
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {onboardingTrialDays}-day free trial for Basic
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You will only be charged after the trial period ends.
              </p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === currentPlan}
                currentPlan={currentPlan}
                onChangePlan={setPendingPlan}
                isUpdating={isUpdating}
                selectedBasicTier={selectedBasicTier}
                onSelectBasicTier={setSelectedBasicTier}
                currentTier={currentTier}
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
              {pendingAction} to {pendingPlanName}
              {pendingTier ? ` (${getBasicTierDisplayName(pendingTier)})` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBasicTierChange
                ? `Your company will stay on the Basic plan and switch to the ${getBasicTierDisplayName(selectedBasicTier)} tier through Stripe billing.`
                : pendingPlan === "premium"
                ? "Premium is $497/month plus a one-time $3,000 setup fee. Billing is managed through Stripe."
                : isDowngrade
                  ? `Your company will move to the ${pendingPlanName} plan and Stripe billing will update to the lower price.`
                  : `Your company will move to the ${pendingPlanName} plan through Stripe billing.`}
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
