import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StripeCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setStatus("error");
        setError(errorDescription || "Authorization was denied");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setError("Missing authorization code or state");
        return;
      }

      try {
        const { data, error: callbackError } = await supabase.functions.invoke(
          "stripe-oauth-callback",
          {
            body: { code, state },
          }
        );

        if (callbackError) {
          throw callbackError;
        }

        if (!data?.success) {
          throw new Error("Failed to complete authorization");
        }

        setStatus("success");

        setTimeout(() => {
          navigate("/settings/stripe?stripe_connected=true");
        }, 2000);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to connect Stripe account");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="card-elevated rounded-lg p-8">
          {status === "loading" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Connecting your Stripe account</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we complete the connection...
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-[hsl(var(--status-confirmed))]" />
              <div>
                <h2 className="text-xl font-semibold">Successfully connected!</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Your Stripe account has been connected. Redirecting you back...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <h2 className="text-xl font-semibold">Connection failed</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {error || "An unexpected error occurred"}
                </p>
              </div>
              <Button
                onClick={() => navigate("/settings/stripe")}
                className="w-full"
              >
                Return to Settings
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
