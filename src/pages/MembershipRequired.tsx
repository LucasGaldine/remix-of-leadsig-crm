import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_ELO_MANAGE_URL = "https://www.elitelandscapingoperator.com/join";

export default function MembershipRequired() {
  const { currentAccount, hasActiveEloEntitlement } = useAuth();
  const manageUrl = import.meta.env.VITE_ELO_MANAGE_URL ?? DEFAULT_ELO_MANAGE_URL;

  if (hasActiveEloEntitlement()) {
    window.location.assign("/");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>ELO membership required</CardTitle>
          <CardDescription>
            This LeadSig account is linked to an ELO membership and is currently inactive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p>Company: <span className="font-medium text-foreground">{currentAccount?.company_name ?? "Unknown"}</span></p>
            <p className="mt-1">Status: <span className="font-medium text-foreground">{currentAccount?.elo_entitlement_status ?? "inactive"}</span></p>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => window.open(manageUrl, "_blank", "noopener,noreferrer")}>
              Manage in ELO
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              I renewed, refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
