import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  type BasicTier,
  type PlanKey,
} from "@/lib/billingPlans";
import {
  getBasicTierDisplayName,
  planOrder,
  pricingPlans,
  PricingPlanCard,
} from "@/components/pricing/PricingPlanCard";

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
    ? pricingPlans.find((p) => p.key === pendingPlan)?.name
    : "";
  const currentPlanName = pricingPlans.find((plan) => plan.key === currentPlan)?.name ?? "Free";

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
                ? `${currentAccount.company_name} is on the ${currentPlanName} plan.`
                : "Scale your operations with the tools and support you need."}
            </p>
          </div>

          {onboardingTrialDays > 0 && (
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {onboardingTrialDays}-day free trial for Essentials
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You will only be charged after the trial period ends.
              </p>
            </div>
          )}

          <div className="sm:hidden px-2">
            <Carousel
              opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
              className="w-full touch-pan-y select-none"
            >
              <CarouselContent className="-ml-2">
                {pricingPlans.map((plan) => (
                  <CarouselItem key={plan.key} className="basis-full pl-2">
                    <PricingPlanCard
                      mode="settings"
                      plan={plan}
                      currentPlan={currentPlan}
                      onAction={setPendingPlan}
                      isUpdating={isUpdating}
                      selectedBasicTier={selectedBasicTier}
                      onSelectBasicTier={setSelectedBasicTier}
                      currentTier={currentTier}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4 top-1/2 h-9 w-9 -translate-y-1/2 border-border/70 bg-background/90 shadow-sm backdrop-blur" />
              <CarouselNext className="-right-4 top-1/2 h-9 w-9 -translate-y-1/2 border-border/70 bg-background/90 shadow-sm backdrop-blur" />
            </Carousel>
          </div>

          <div className="hidden gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <PricingPlanCard
                key={plan.key}
                mode="settings"
                plan={plan}
                currentPlan={currentPlan}
                onAction={setPendingPlan}
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
                ? `Your company will stay on the Essentials plan and switch to the ${getBasicTierDisplayName(selectedBasicTier)} tier through Stripe billing.`
                : pendingPlan === "premium"
                ? "Pro is $497/month plus a one-time $3,000 setup fee. Billing is managed through Stripe."
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
