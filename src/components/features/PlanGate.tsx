import { ArrowLeft, Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { type PricingPlan, hasPlanAccess, planNames } from "@/lib/planGating";

interface PlanGateProps {
  requiredPlan: PricingPlan;
  featureName: string;
  featureDescription: string;
  backTo: string;
  children: React.ReactNode;
}

export function PlanGate({
  requiredPlan,
  featureName,
  featureDescription,
  backTo,
  children,
}: PlanGateProps) {
  const { currentAccount, role } = useAuth();
  const navigate = useNavigate();
  const currentPlan: PricingPlan = currentAccount?.pricing_plan ?? "free";

  if (hasPlanAccess(currentPlan, requiredPlan)) {
    return <>{children}</>;
  }

  const isOwner = role === "owner";

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="bg-card border-b border-border px-4 py-3">
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-h-touch"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Settings</span>
        </button>
      </div>

      <main className="px-4 py-8 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
            <Crown className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{featureName}</h1>
          <p className="text-muted-foreground">{featureDescription}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-amber-100 rounded-full p-1.5 mt-0.5 shrink-0">
              <Crown className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {planNames[requiredPlan]} plan required
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentAccount?.company_name || "Your company"} is currently on the{" "}
                <span className="font-medium text-foreground">{planNames[currentPlan]}</span> plan.
                {" "}{featureName} is available on the{" "}
                <span className="font-medium text-foreground">{planNames[requiredPlan]}</span> plan
                {requiredPlan === "basic" ? " and above" : ""}.
              </p>
            </div>
          </div>

          {isOwner ? (
            <Button
              className="w-full gap-2"
              onClick={() => navigate("/settings/pricing")}
            >
              View Pricing Plans
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Ask your account owner to upgrade the plan to access this feature.
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate(backTo)}
        >
          Back to Settings
        </Button>
      </main>
    </div>
  );
}
