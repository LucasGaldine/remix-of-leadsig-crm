import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FacebookPage {
  id: string;
  name: string;
}

type Status = "loading" | "select_page" | "connecting" | "success" | "error";

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);

  useEffect(() => {
    handleCallback();
  }, []);

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
      const redirectUri = `${window.location.origin}/facebook-callback`;

      const { data, error: fnError } = await supabase.functions.invoke(
        "facebook-oauth-callback",
        { body: { code, state, redirectUri } }
      );

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to complete authorization");
      }

      if (data.pages && data.pages.length > 0) {
        setPages(data.pages);
        setStatus("select_page");
      } else {
        setStatus("error");
        setError(
          "No Facebook Pages found. You need at least one Facebook Page with admin access."
        );
      }
    } catch (err) {
      console.error("Facebook OAuth callback error:", err);
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to connect Facebook"
      );
    }
  };

  const handleSelectPage = async (page: FacebookPage) => {
    setStatus("connecting");

    try {
      let accountId: string | null = null;
      const state = searchParams.get("state");
      if (state) {
        try {
          const decoded = JSON.parse(atob(state));
          accountId = decoded.accountId;
        } catch {
          // ignore decode errors
        }
      }

      if (!accountId) {
        throw new Error("Missing account context");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "facebook-oauth-callback",
        {
          body: {
            action: "select_page",
            pageId: page.id,
            pageName: page.name,
            accountId,
          },
        }
      );

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to connect page");
      }

      setStatus("success");
      setTimeout(() => {
        navigate("/settings/lead-sources?facebook_connected=true");
      }, 2000);
    } catch (err) {
      console.error("Facebook page selection error:", err);
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to connect Facebook Page"
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="card-elevated rounded-lg p-8">
          {status === "loading" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h2 className="text-xl font-semibold">
                  Connecting to Facebook
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we complete the connection...
                </p>
              </div>
            </div>
          )}

          {status === "select_page" && (
            <div className="space-y-4">
              <div className="text-center">
                <svg
                  className="h-10 w-10 mx-auto mb-3"
                  viewBox="0 0 24 24"
                  fill="#1877F2"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <h2 className="text-xl font-semibold">Select a Page</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose which Facebook Page to receive leads from
                </p>
              </div>

              <div className="space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handleSelectPage(page)}
                    className="w-full p-4 border border-border rounded-lg text-left hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{page.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Page ID: {page.id}
                    </p>
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/settings/lead-sources")}
              >
                Cancel
              </Button>
            </div>
          )}

          {status === "connecting" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h2 className="text-xl font-semibold">
                  Subscribing to lead events
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Setting up your Facebook Page to send leads to LeadSig...
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-[hsl(var(--status-confirmed))]" />
              <div>
                <h2 className="text-xl font-semibold">
                  Facebook connected!
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Your Facebook Page is now connected. Leads from your ad forms
                  will appear automatically. Redirecting...
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
                onClick={() => navigate("/settings/lead-sources")}
                className="w-full"
              >
                Return to Lead Sources
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
