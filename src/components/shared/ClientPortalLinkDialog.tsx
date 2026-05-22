import { Check, Copy, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ClientPortalLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalLink: string;
  copied: boolean;
  onCopy: () => Promise<void> | void;
  onTextClient?: () => Promise<void> | void;
  onEmailClient?: () => Promise<void> | void;
  emailSending?: boolean;
  emailSent?: boolean;
  clientPhone?: string | null;
  clientEmail?: string | null;
  allowTextClient?: boolean;
  allowEmailClient?: boolean;
  portalSentAt?: string | null;
  portalViewedAt?: string | null;
}

const formatPortalStatusDate = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

export function ClientPortalLinkDialog({
  open,
  onOpenChange,
  portalLink,
  copied,
  onCopy,
  onTextClient,
  onEmailClient,
  emailSending = false,
  emailSent = false,
  clientPhone,
  clientEmail,
  allowTextClient = true,
  allowEmailClient = true,
  portalSentAt = null,
  portalViewedAt = null,
}: ClientPortalLinkDialogProps) {
  const normalizedClientPhone = clientPhone?.trim() || "";
  const normalizedClientEmail = clientEmail?.trim() || "";
  const canTextClient = allowTextClient && normalizedClientPhone.length > 0;
  const canEmailClient = allowEmailClient && normalizedClientEmail.length > 0;
  const viewedLabel = portalViewedAt ? formatPortalStatusDate(portalViewedAt) : null;
  const portalStatusText = viewedLabel ? `Viewed on ${viewedLabel}` : portalSentAt ? "Not viewed yet" : "Not sent yet";

  const handleTextClient = async () => {
    if (!allowTextClient) {
      toast.error("Sending portal links by text is not available on the Free plan.");
      return;
    }
    if (!canTextClient) {
      toast.error("Add a customer phone number before sending a text.");
      return;
    }
    if (onTextClient) {
      await onTextClient();
      return;
    }
    window.open(`sms:${normalizedClientPhone}`, "_blank");
  };

  const handleEmailClient = async () => {
    if (!allowEmailClient) {
      toast.error("Sending portal links by email is not available on the Free plan.");
      return;
    }
    if (!canEmailClient) {
      toast.error("Add a customer email before sending an email.");
      return;
    }
    if (!onEmailClient) {
      window.open(`mailto:${normalizedClientEmail}`, "_blank");
      return;
    }
    await onEmailClient();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client Portal Link</DialogTitle>
          <DialogDescription>
            Share this link with your contact so they can view their jobs, estimates, and invoices.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            value={portalLink}
            readOnly
            className="flex-1"
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex w-full items-center gap-2">
          <Button
            type="button"
            className={`flex-1 ${!canTextClient ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={handleTextClient}
            disabled={!allowTextClient}
            aria-disabled={!canTextClient}
            data-disabled={!canTextClient ? "true" : undefined}
          >
            <MessageSquare className="h-4 w-4" />
            Send via text
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={`flex-1 ${!canEmailClient ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={handleEmailClient}
            disabled={emailSending || !allowEmailClient}
            aria-disabled={!canEmailClient || emailSending || !allowEmailClient}
            data-disabled={!canEmailClient ? "true" : undefined}
          >
            <Mail className="h-4 w-4" />
            {emailSending ? "Sending" : emailSent ? "Email sent" : "Send via email"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{portalStatusText}</p>
      </DialogContent>
    </Dialog>
  );
}
