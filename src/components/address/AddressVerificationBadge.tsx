import { CheckCircle2, XCircle, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  verifying: boolean;
  result: { verified: boolean; formatted?: string; error?: string } | null;
  onVerify: () => void;
  onAccept?: (formatted: string) => void;
  className?: string;
}

export function AddressVerificationBadge({ verifying, result, onVerify, onAccept, className }: Props) {
  if (verifying) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground mt-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying with USPS...
      </div>
    );
  }

  if (result?.verified && result.formatted) {
    return (
      <div className={cn("mt-1 space-y-1", className)}>
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          USPS verified
        </div>
        {onAccept && (
          <button
            type="button"
            onClick={() => onAccept(result.formatted!)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <MapPin className="h-3 w-3" />
            Use: {result.formatted}
          </button>
        )}
      </div>
    );
  }

  if (result && !result.verified) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-destructive mt-1", className)}>
        <XCircle className="h-3 w-3" />
        {result.error || "Address not found"}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onVerify}
      className={cn("h-6 px-2 text-xs text-muted-foreground hover:text-foreground mt-1", className)}
    >
      <MapPin className="h-3 w-3 mr-1" />
      Verify address
    </Button>
  );
}
