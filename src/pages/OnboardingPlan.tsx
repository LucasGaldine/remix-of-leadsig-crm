import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type BasicTier, type PlanKey } from "@/lib/billingPlans";
import { getBasicTierDisplayName, planOrder, pricingPlans, PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { completeOnboardingPlan, markPostOnboardingSkoolModalPending } from "@/lib/onboarding";

export default function OnboardingPlan() {
  const navigate = useNavigate();
  const { currentAccount, refreshProfile } = useAuth();
  const currentPlan: PlanKey = (currentAccount?.pricing_plan as PlanKey) ?? "free";
  const currentTier: BasicTier | null = (currentAccount as { pricing_tier?: BasicTier | null } | null)?.pricing_tier ?? null;
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [selectedBasicTier, setSelectedBasicTier] = useState<BasicTier>(currentTier ?? "solo");
  const [isUpdating, setIsUpdating] = useState(false);

  const isDowngrade = pendingPlan ? planOrder[pendingPlan] < planOrder[currentPlan] : false;
  const isBasicTierChange = pendingPlan === "basic"
    && currentPlan === "basic"
    && currentTier !== null
    && selectedBasicTier !== currentTier;
  const pendingAction = isBasicTierChange ? "Change tier" : isDowngrade ? "Downgrade" : "Upgrade";
  const pendingPlanName = pendingPlan
    ? pricingPlans.find((plan) => plan.key === pendingPlan)?.name
    : "";
  const pendingTier: BasicTier | null = pendingPlan === "basic" ? selectedBasicTier : null;

  const handleContinue = () => {
    completeOnboardingPlan();
    markPostOnboardingSkoolModalPending();
    navigate("/");
  };

  const handleChangePlan = async () => {
    if (!pendingPlan || !currentAccount) return;

    setIsUpdating(true);

    const { data, error } = await supabase.functions.invoke("stripe-manage-subscription", {
      body: {
        accountId: currentAccount.id,
        targetPlan: pendingPlan,
        targetTier: pendingTier,
        trialDays: 0,
        returnUrl: `${window.location.origin}/onboarding/plan`,
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
    <div className="min-h-screen bg-surface-sunken pb-10">
      <PageHeader
        title=""
        hideTitle
        profileClickable={false}
        showNotifications={false}
        showSearch={false}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Step 4 of 4</div>
          <div className="grid grid-cols-4 gap-2" aria-hidden>
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">Upgrade your account</CardTitle>
            <CardDescription className="text-base">
              Choose your starting plan. You can change it anytime from Billing Settings.
            </CardDescription>
          </CardHeader>
        </Card>

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
                      currentTier={currentTier}
                      selectedBasicTier={selectedBasicTier}
                      onSelectBasicTier={setSelectedBasicTier}
                      isUpdating={isUpdating}
                      onAction={setPendingPlan}
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
              currentTier={currentTier}
              selectedBasicTier={selectedBasicTier}
              onSelectBasicTier={setSelectedBasicTier}
              isUpdating={isUpdating}
              onAction={setPendingPlan}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleContinue}>
            <Trophy className="mr-2 h-4 w-4" />
            Complete onboarding
          </Button>
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
    </div>
  );
}
