import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientShareLinkProps {
  jobId: string;
  existingToken?: string | null;
}

export function ClientShareLink({ jobId, existingToken }: ClientShareLinkProps) {
  const [token, setToken] = useState<string | null>(existingToken || null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = token
    ? `${window.location.origin}/client/job?token=${token}`
    : null;

  const generateLink = async () => {
    setGenerating(true);
    try {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("leads")
        .update({ client_share_token: newToken })
        .eq("id", jobId);

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

  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-secondary">
          <Share2 className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Client Portal Link</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share a link so your client can view their job status, estimate, photos, and schedule.
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
