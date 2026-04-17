import { Check, Crown, Leaf, X, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BASIC_TIER_CONFIG,
  getBasicTierMonthlyPrice,
  getBasicTierSeatLabel,
  hasLandscapingSkoolAccess,
  type BasicTier,
  type PlanKey,
} from "@/lib/billingPlans";
import { cn } from "@/lib/utils";

export const planOrder: Record<PlanKey, number> = { free: 0, basic: 1, premium: 2 };

interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PricingPlanDefinition {
  key: PlanKey;
  name: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  badge?: string;
}

export const pricingPlans: PricingPlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    period: "/month",
    description: "Get started with basic lead storage and tracking.",
    icon: <Leaf className="h-6 w-6" />,
  },
  {
    key: "basic",
    name: "Essentials",
    period: "/month",
    description: "Tiered pricing for growing teams with automation-ready workflows.",
    icon: <Zap className="h-6 w-6" />,
  },
  {
    key: "premium",
    name: "Pro",
    period: "/month",
    description: "Full automation, lead generation support, and premium onboarding.",
    icon: <Crown className="h-6 w-6" />,
    highlighted: true,
    badge: "Most Popular",
  },
];

export function getPlanFeatures(plan: PlanKey, basicTier: BasicTier): PlanFeature[] {
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

export function getBasicTierDisplayName(tier: BasicTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

type PricingPlanCardProps =
  | {
      mode: "settings";
      plan: PricingPlanDefinition;
      currentPlan: PlanKey;
      currentTier: BasicTier | null;
      selectedBasicTier: BasicTier;
      onSelectBasicTier: (tier: BasicTier) => void;
      isUpdating: boolean;
      onAction: (plan: PlanKey) => void;
    }
  | {
      mode: "onboarding";
      plan: PricingPlanDefinition;
      selectedPlan: PlanKey;
      selectedBasicTier: BasicTier;
      onSelectBasicTier: (tier: BasicTier) => void;
      isUpdating: boolean;
      onAction: (plan: PlanKey) => void;
    };

export function PricingPlanCard(props: PricingPlanCardProps) {
  const { plan, selectedBasicTier, onSelectBasicTier, isUpdating } = props;
  const displayTier = selectedBasicTier;
  const features = getPlanFeatures(plan.key, displayTier);
  const hasTopBadge = props.mode === "settings" && (plan.key === props.currentPlan || (props.currentPlan !== plan.key && !!plan.badge));

  let isSelected = false;
  let buttonDisabled = false;
  let buttonLabel = "";
  let buttonVariant: "default" | "outline" = "default";

  if (props.mode === "settings") {
    const { currentPlan, currentTier } = props;
    const isCurrent = plan.key === currentPlan;
    const isDowngrade = planOrder[plan.key] < planOrder[currentPlan];
    const isCurrentBasicPlan = plan.key === "basic" && currentPlan === "basic";
    const isBasicTierChange = isCurrentBasicPlan && currentTier !== null && displayTier !== currentTier;
    const isCurrentSelection = isCurrent && !isBasicTierChange;
    const isBasicTierDowngrade = isCurrentBasicPlan
      && currentTier !== null
      && getBasicTierMonthlyPrice(displayTier) < getBasicTierMonthlyPrice(currentTier);

    isSelected = isCurrentSelection;
    buttonDisabled = isUpdating || isCurrentSelection;
    buttonVariant = isDowngrade || isBasicTierDowngrade ? "outline" : "default";

    if (isCurrentSelection) {
      buttonLabel = "Current Plan";
    } else if (isCurrentBasicPlan) {
      buttonLabel = `Switch to ${getBasicTierDisplayName(displayTier)}`;
    } else if (isDowngrade) {
      buttonLabel = `Downgrade to ${plan.name}`;
    } else {
      buttonLabel = `Upgrade to ${plan.name}`;
    }
  } else {
    isSelected = props.selectedPlan === plan.key;
    buttonDisabled = isUpdating || isSelected;
    buttonVariant = isSelected ? "outline" : "default";
    buttonLabel = isSelected ? "Selected" : `Select ${plan.name}`;
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 transition-shadow",
        hasTopBadge && "pt-10",
        isSelected ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border shadow-sm",
      )}
    >
      {props.mode === "settings" && isSelected && (
        <Badge className="absolute left-1/2 top-2 -translate-x-1/2 px-3 py-0.5 text-xs">
          Current Plan
        </Badge>
      )}
      {props.mode === "settings" && props.currentPlan !== plan.key && plan.badge && (
        <Badge
          variant="outline"
          className="absolute left-1/2 top-2 -translate-x-1/2 bg-card px-3 py-0.5 text-xs"
        >
          {plan.badge}
        </Badge>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2", isSelected ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground")}>
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

      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

      <div className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature.label} className="flex items-center gap-2.5">
            {feature.included ? (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <X className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span className={cn("text-sm", feature.included ? "text-foreground" : "text-muted-foreground/60")}>
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      <Button
        variant={buttonVariant}
        className={cn("w-full", plan.highlighted && buttonVariant === "default" && "shadow-sm")}
        onClick={() => props.onAction(plan.key)}
        disabled={buttonDisabled}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
