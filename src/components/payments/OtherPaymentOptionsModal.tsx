import { useState } from "react";
import { FileCheck, Banknote, Landmark, ArrowRightLeft, Loader2, Send, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PaymentOption = "cash" | "check" | "ach";

interface OtherPaymentOptionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingLabel?: string;
  onSendInvoice?: () => void | Promise<void>;
  sendingInvoice?: boolean;
  sendInvoiceDisabled?: boolean;
  sendInvoiceHelperText?: string;
  onInPersonPayment?: () => void | Promise<void>;
  inPersonPaymentDisabled?: boolean;
  inPersonPaymentHelperText?: string;
  onMarkAsSent?: () => Promise<void>;
  onRecordPayment: (method: PaymentOption, amount: number) => Promise<void>;
  onOpenTapToPay?: (amount: number) => void;
  markingAsSent?: boolean;
  recordingPayment: boolean;
}

const paymentOptions: { id: PaymentOption; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Record Cash Payment", icon: Banknote },
  { id: "check", label: "Record Check Payment", icon: FileCheck },
  { id: "ach", label: "ACH Transfer", icon: Landmark },
];

export function OtherPaymentOptionsModal({
  open,
  onOpenChange,
  totalAmount,
  paidAmount = 0,
  remainingAmount,
  remainingLabel = "Remaining",
  onSendInvoice,
  sendingInvoice = false,
  sendInvoiceDisabled = false,
  sendInvoiceHelperText,
  onInPersonPayment,
  inPersonPaymentDisabled = false,
  inPersonPaymentHelperText,
  onMarkAsSent,
  onRecordPayment,
  onOpenTapToPay,
  markingAsSent = false,
  recordingPayment,
}: OtherPaymentOptionsModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentOption | null>(null);
  const [amount, setAmount] = useState("");
  const busy = markingAsSent || recordingPayment || sendingInvoice;
  const resolvedRemainingAmount = remainingAmount ?? Math.max(Number(totalAmount || 0) - Number(paidAmount || 0), 0);
  const formattedPaidAmount = Number(paidAmount || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedRemainingAmount = resolvedRemainingAmount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleClose = () => {
    if (busy) return;
    setSelectedMethod(null);
    setAmount("");
    onOpenChange(false);
  };

  const handleSelectMethod = (method: PaymentOption) => {
    setSelectedMethod(method);
    setAmount(resolvedRemainingAmount.toFixed(2));
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setAmount("");
  };

  const handleConfirmPayment = async () => {
    if (!selectedMethod) return;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    await onRecordPayment(selectedMethod, parsedAmount);
    setSelectedMethod(null);
    setAmount("");
  };

  if (selectedMethod) {
    const option = paymentOptions.find((o) => o.id === selectedMethod)!;
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{option.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="payment-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBack}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPayment}
                disabled={busy || !parseFloat(amount)}
              >
                {recordingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {recordingPayment ? "Recording..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Payment Options</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <div className="px-1 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid</p>
                <p className="text-2xl font-semibold leading-tight text-foreground">{formattedPaidAmount}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{remainingLabel}</p>
                <p className="text-2xl font-semibold leading-tight text-foreground">{formattedRemainingAmount}</p>
              </div>
            </div>
          </div>

          {onInPersonPayment && (
            <button
              type="button"
              onClick={async () => {
                await onInPersonPayment();
              }}
              disabled={busy || inPersonPaymentDisabled}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border text-left",
                "transition-colors active:scale-[0.98]",
                "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                (busy || inPersonPaymentDisabled) && "opacity-60 cursor-not-allowed hover:bg-primary",
              )}
            >
              <div className="p-2 rounded-lg bg-primary-foreground/15">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-primary-foreground">In Person Payment</p>
              </div>
            </button>
          )}

          {onSendInvoice && (
            <button
              type="button"
              onClick={async () => {
                await onSendInvoice();
              }}
              disabled={busy || sendInvoiceDisabled}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border border-border text-left",
                "hover:bg-secondary/50 transition-colors active:scale-[0.98]",
                (busy || sendInvoiceDisabled) && "opacity-60 cursor-not-allowed hover:bg-transparent",
              )}
            >
              <div className="p-2 rounded-lg bg-secondary">
                {sendingInvoice ? (
                  <Loader2 className="h-5 w-5 animate-spin text-secondary-foreground" />
                ) : (
                  <Send className="h-5 w-5 text-secondary-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{sendingInvoice ? "Opening..." : "Send Invoice"}</p>
              </div>
            </button>
          )}

          {onMarkAsSent && (
            <button
              onClick={onMarkAsSent}
              disabled={busy}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border border-border text-left",
                "hover:bg-secondary/50 transition-colors active:scale-[0.98]",
                busy && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="p-2 rounded-lg bg-secondary">
                <ArrowRightLeft className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {markingAsSent ? "Creating Invoice..." : "Mark as Sent"}
                </p>
                <p className="text-sm text-muted-foreground">Convert to invoice</p>
              </div>
            </button>
          )}

          {paymentOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelectMethod(option.id)}
              disabled={busy}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border border-border text-left",
                "hover:bg-secondary/50 transition-colors active:scale-[0.98]",
                busy && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="p-2 rounded-lg bg-secondary">
                <option.icon className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{option.label}</p>
              </div>
            </button>
          ))}

        </div>
      </DialogContent>
    </Dialog>
  );
}
