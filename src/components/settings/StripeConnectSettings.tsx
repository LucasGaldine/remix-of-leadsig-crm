import { 
  CreditCard, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw,
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { cn } from "@/lib/utils";

export function StripeConnectSettings() {
  const { 
    status, 
    loading, 
    connecting, 
    startOnboarding, 
    openDashboard, 
    checkStatus 
  } = useStripeConnect();

  const getStatusDisplay = () => {
    if (loading) {
      return {
        icon: <Loader2 className="h-5 w-5 animate-spin" />,
        label: "Checking...",
        className: "bg-secondary text-secondary-foreground",
        description: "Checking your Stripe connection status",
      };
    }

    if (!status?.connected) {
      return {
        icon: <CreditCard className="h-5 w-5" />,
        label: "Not Connected",
        className: "bg-secondary text-secondary-foreground",
        description: "Connect your Stripe account to accept card payments",
      };
    }

    switch (status.status) {
      case "active":
        return {
          icon: <Check className="h-5 w-5" />,
          label: "Connected",
          className: "bg-[hsl(var(--status-confirmed-bg))] text-[hsl(var(--status-confirmed))]",
          description: "Your Stripe account is ready to accept payments",
        };
      case "action_required":
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          label: "Action Required",
          className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]",
          description: "Stripe needs additional information to verify your account",
        };
      case "pending":
        return {
          icon: <RefreshCw className="h-5 w-5" />,
          label: "Pending",
          className: "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]",
          description: "Your Stripe account is being reviewed",
        };
      default:
        return {
          icon: <CreditCard className="h-5 w-5" />,
          label: "Unknown",
          className: "bg-secondary text-secondary-foreground",
          description: "Unable to determine status",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="card-elevated rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", statusDisplay.className)}>
            {statusDisplay.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Stripe Payments</p>
              <span className={cn("text-2xs px-2 py-0.5 rounded-full", statusDisplay.className)}>
                {statusDisplay.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {statusDisplay.description}
            </p>
          </div>
        </div>

        {/* Action Requirements */}
        {status?.status === "action_required" && status.requirements && status.requirements.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--status-attention-bg))]">
            <p className="text-sm font-medium text-[hsl(var(--status-attention))]">
              Complete these items in Stripe:
            </p>
            <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside">
              {status.requirements.slice(0, 3).map((req, i) => (
                <li key={i}>{req.replace(/_/g, " ")}</li>
              ))}
              {status.requirements.length > 3 && (
                <li>And {status.requirements.length - 3} more...</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {!status?.connected ? (
          <Button 
            className="w-full gap-2" 
            onClick={startOnboarding}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Connect Stripe Account
          </Button>
        ) : status.status === "action_required" ? (
          <Button 
            className="w-full gap-2" 
            onClick={startOnboarding}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Complete Stripe Setup
          </Button>
        ) : status.status === "active" && (
          <Button 
            variant="outline" 
            className="w-full gap-2" 
            onClick={openDashboard}
          >
            <ExternalLink className="h-4 w-4" />
            Open Stripe Dashboard
          </Button>
        )}

        {status?.connected && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full gap-2" 
            onClick={checkStatus}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh Status
          </Button>
        )}
      </div>

      {/* Info Text */}
      <p className="text-xs text-muted-foreground text-center">
        Payments go directly to your Stripe account. LeadSig never holds your funds.
      </p>
    </div>
  );
}
