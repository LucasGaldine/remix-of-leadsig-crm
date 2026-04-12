import { Check, Copy, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ClientPortalLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalLink: string;
  copied: boolean;
  onCopy: () => Promise<void> | void;
  clientPhone?: string | null;
  clientEmail?: string | null;
}

export function ClientPortalLinkDialog({
  open,
  onOpenChange,
  portalLink,
  copied,
  onCopy,
  clientPhone,
  clientEmail,
}: ClientPortalLinkDialogProps) {
  const normalizedClientPhone = clientPhone?.trim() || "";
  const normalizedClientEmail = clientEmail?.trim() || "";
  const canTextClient = normalizedClientPhone.length > 0;
  const canEmailClient = normalizedClientEmail.length > 0;

  const handleTextClient = () => {
    if (!canTextClient) return;
    window.open(`sms:${normalizedClientPhone}`, "_blank");
  };

  const handleEmailClient = () => {
    if (!canEmailClient) return;
    window.open(`mailto:${normalizedClientEmail}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client Portal Link</DialogTitle>
          <DialogDescription>
            Share this link with your client so they can view their jobs, estimates, and invoices.
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
          <Button type="button" className="flex-1" onClick={handleTextClient} disabled={!canTextClient}>
            <MessageSquare className="h-4 w-4" />
            Text Client
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleEmailClient}
            disabled={!canEmailClient}
          >
            <Mail className="h-4 w-4" />
            Email Client
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
