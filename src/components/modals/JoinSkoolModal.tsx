import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasLandscapingSkoolAccess, type BasicTier, type PlanKey } from "@/lib/billingPlans";

interface JoinSkoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanKey;
  tier: BasicTier | null;
  joinUrl?: string | null;
}

export function JoinSkoolModal({
  open,
  onOpenChange,
  plan,
  tier,
  joinUrl = null,
}: JoinSkoolModalProps) {
  const hasPremiumSkoolAccess = hasLandscapingSkoolAccess(plan, tier);
  const hasFreeAccount = plan === "free";

  const accessMessage = hasPremiumSkoolAccess
    ? "You unlocked Premium Skool access with your plan. Enjoy the full training library, advanced playbooks, and priority community support."
    : hasFreeAccount
      ? "Your Free account includes free access to the Skool community."
      : "You can join the free Skool community now. Upgrade to Essentials Growth or Pro for Premium Skool access.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <img
            src="/skool-logo.svg"
            alt="Skool logo"
            className="h-8 w-auto"
          />
          <DialogTitle>Join the Skool Community</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Join the LeadSig Skool community to get training, implementation tips, and support from other contractors.
            </span>
            <span className="block font-medium text-foreground">{accessMessage}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          {joinUrl ? (
            <Button asChild>
              <a href={joinUrl} target="_blank" rel="noreferrer">
                Join Skool
              </a>
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Got it</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
