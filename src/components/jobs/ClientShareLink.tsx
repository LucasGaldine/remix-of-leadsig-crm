import { useState, useEffect } from "react";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientShareLinkProps {
  customerId: string;
}

export function ClientShareLink({ customerId }: ClientShareLinkProps) {
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const shareUrl = token
    ? `${window.location.origin}/client/job?token=${token}`
    : null;

  useEffect(() => {
    fetchExistingToken();
  }, [customerId]);

  const fetchExistingToken = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("client_portal_token")
        .eq("id", customerId)
        .maybeSingle();

      if (!error && data?.client_portal_token) {
        setToken(data.client_portal_token);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    setGenerating(true);
    try {
      const newToken = crypto.randomUUID();

      const { error } = await supabase
        .from("customers")
        .update({ client_portal_token: newToken })
        .eq("id", customerId);

      if (error) throw error;

      setToken(newToken);
      toast.success("Share link created");
    } catch {
      toast.error("Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (loading) {
    return (
      <div className="card-elevated rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-secondary">
          <Share2 className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Client Portal Link</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share a link so your client can view all their jobs, estimates, photos, and schedules in one place.
          </p>

          {shareUrl ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {shareUrl}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={generateLink}
                  disabled={generating}
                >
                  <RefreshCw className="h-4 w-4" />
                  New Link
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={generateLink}
              disabled={generating}
            >
              {generating ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generate Share Link
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
