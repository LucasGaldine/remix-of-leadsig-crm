import { useState } from "react";
import { Check, Crown, Leaf, X, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BASIC_TIER_CONFIG,
  getBasicTierMonthlyPrice,
  getBasicTierSeatLabel,
  type BasicTier,
  type PlanKey,
} from "@/lib/billingPlans";
import { cn } from "@/lib/utils";

export const planOrder: Record<PlanKey, number> = { free: 0, basic: 1, premium: 2 };

interface PlanFeature {
  label: string;
  included: boolean;
}

type PremiumServiceOption = "done-with-you" | "done-for-you";

function getPremiumServiceMonthlyPrice(option: PremiumServiceOption): number {
  return option === "done-for-you" ? 1997 : 1997;
}

const ELO_ACCELERATOR_LEARN_MORE_URL = "https://www.elitelandscapingoperator.com/join";

function getUserFeature(plan: PlanKey, basicTier: BasicTier): PlanFeature {
  if (plan === "free") {
    return { label: "1 user", included: false };
  }

  if (plan === "basic") {
    const tierConfig = BASIC_TIER_CONFIG[basicTier];
    const includesMultipleUsers = tierConfig.maxMembers === null || tierConfig.maxMembers > 1;

    return {
      label: tierConfig.seatLabel,
      included: includesMultipleUsers,
    };
  }

  return { label: "Unlimited users", included: true };
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
    badge: "Most Popular",
  },
  {
    key: "premium",
    name: "ELO Accelerator",
    period: "/month",
    description: "Partner with our professionals at LeadSig to level up your service business.",
    icon: <Crown className="h-6 w-6" />,
    highlighted: true,
  },
];

export function getPlanFeatures(plan: PlanKey, basicTier: BasicTier): PlanFeature[] {
  const eloCommunityIncluded = true;
  const userFeature = getUserFeature(plan, basicTier);

  if (plan === "free") {
    return [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking and scheduling", included: true },
      { label: "ELO Community", included: eloCommunityIncluded },
      { label: "Before photos on leads", included: false },
      { label: "Ad Account Integrations", included: false },
      { label: "Branded Website & Client Portal", included: false },
      { label: "Automations & auto-replies", included: false },
      { label: "SMS & email notifications", included: false },
      userFeature,
    ];
  }

  if (plan === "basic") {
    return [
      { label: "Lead storage & management", included: true },
      { label: "Job tracking and scheduling", included: true },
      { label: "ELO Community", included: eloCommunityIncluded },
      { label: "Before photos on leads", included: true },
      { label: "Ad Account Integrations", included: true },
      { label: "Branded Website & Client Portal", included: true },
      { label: "SMS & email notifications", included: true },
      { label: "Automations & auto-replies", included: true },
      userFeature,
    ];
  }

  return [
    { label: "All LeadSig CRM features", included: true },
    { label: "1 on 1 Business Coaching", included: true },
    { label: "LeadSig Lead Generation", included: true },
    { label: "Hireflow HR Management", included: true },
    { label: "Social Media Management", included: true },
  ];
}

function getPlanPrice(plan: PlanKey, basicTier: BasicTier, premiumService: PremiumServiceOption): string {
  const formatPrice = (value: number) => `$${value.toLocaleString("en-US")}`;

  if (plan === "free") {
    return formatPrice(0);
  }

  if (plan === "basic") {
    return formatPrice(getBasicTierMonthlyPrice(basicTier));
  }

  return formatPrice(getPremiumServiceMonthlyPrice(premiumService));
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
  const [selectedPremiumService, setSelectedPremiumService] = useState<PremiumServiceOption>("done-with-you");
  const isPrimaryPlan = plan.key === "premium";
  const features = getPlanFeatures(plan.key, displayTier);
  const hasTopBadge = props.mode === "settings" && props.currentPlan !== plan.key && !!plan.badge;

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

  if (plan.key === "premium") {
    const isCurrentPremiumPlan = props.mode === "settings" && isSelected;
    buttonLabel = isCurrentPremiumPlan ? "Current Plan" : "Learn More";
    buttonDisabled = isCurrentPremiumPlan || isUpdating;
  }

  const handleActionClick = () => {
    if (plan.key === "premium" && props.mode === "settings" && isSelected) {
      return;
    }

    if (plan.key === "premium") {
      window.location.assign(ELO_ACCELERATOR_LEARN_MORE_URL);
      return;
    }

    props.onAction(plan.key);
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border bg-card p-6 transition-shadow",
        hasTopBadge && "pt-8",
        isPrimaryPlan && "border-primary bg-primary text-primary-foreground shadow-lg",
        isSelected ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border shadow-sm",
      )}
    >
      {props.mode === "settings" && props.currentPlan !== plan.key && plan.badge && (
        <Badge
          variant="outline"
          className={cn(
            "absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-0.5 text-xs",
            isPrimaryPlan
              ? "border-primary-foreground/40 bg-primary text-primary-foreground"
              : "bg-card",
          )}
        >
          {plan.badge}
        </Badge>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "rounded-lg p-2",
            isPrimaryPlan
              ? "bg-primary-foreground/15 text-primary-foreground"
              : isSelected
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {plan.icon}
        </div>
        <h3 className={cn("text-lg font-semibold", isPrimaryPlan ? "text-primary-foreground" : "text-foreground")}>
          {plan.name}
        </h3>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span className={cn("text-3xl font-bold tracking-tight", isPrimaryPlan ? "text-primary-foreground" : "text-foreground")}>
          {getPlanPrice(plan.key, displayTier, selectedPremiumService)}
        </span>
        <span className={cn("text-sm", isPrimaryPlan ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {plan.period}
        </span>
      </div>

      {plan.key === "premium" && (
        <div className="mb-6">
          <select
            aria-label="Premium service option"
            className={cn(
              "w-full rounded-xl border px-4 py-2.5 text-base font-semibold",
              isPrimaryPlan
                ? "border-primary-foreground/45 bg-primary/30 text-primary-foreground"
                : "border bg-background text-foreground",
            )}
            value={selectedPremiumService}
            onChange={(event) => setSelectedPremiumService(event.target.value as PremiumServiceOption)}
            disabled={isUpdating}
          >
            <option value="done-with-you">Done With You</option>
            <option value="done-for-you">Done For You</option>
          </select>
        </div>
      )}

      {plan.key !== "basic" && (
        <p className={cn("mb-6 text-sm leading-relaxed", isPrimaryPlan ? "text-primary-foreground/85" : "text-muted-foreground")}>
          {plan.description}
        </p>
      )}

      {plan.key === "basic" && (
        <div className="mb-6">
          <select
            aria-label="Basic tier"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
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
        </div>
      )}

      <div className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature.label} className="flex items-center gap-2.5">
            {feature.included ? (
              <Check className={cn("h-4 w-4 shrink-0", isPrimaryPlan ? "text-primary-foreground" : "text-primary")} />
            ) : (
              <X className={cn("h-4 w-4 shrink-0", isPrimaryPlan ? "text-primary-foreground/45" : "text-muted-foreground/40")} />
            )}
            <span
              className={cn(
                "text-sm",
                feature.included
                  ? isPrimaryPlan
                    ? "text-primary-foreground"
                    : "text-foreground"
                  : isPrimaryPlan
                  ? "text-primary-foreground/60"
                  : "text-muted-foreground/60",
              )}
            >
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      <Button
        variant={isPrimaryPlan && buttonVariant === "default" ? "secondary" : buttonVariant}
        className={cn("w-full", plan.highlighted && buttonVariant === "default" && "shadow-sm")}
        onClick={handleActionClick}
        disabled={buttonDisabled}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
