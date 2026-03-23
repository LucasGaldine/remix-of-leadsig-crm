import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  Check,
  User,
  DollarSign,
  FileText,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PaymentMethod } from "@/types/payments";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import {
  createTapToPayDeepLink,
  isDirectTapToPayHandoffSupported,
  type TapToPayPaymentSessionResponse,
} from "@/lib/tapToPay";
import { toast } from "sonner";

// Demo customers with open invoices
const customersWithBalance = [
  { id: "cust-1", name: "Martinez Backyard", invoiceId: "inv-1", balance: 4536, jobName: "Walkway Installation", email: "martinez@example.com" },
  { id: "cust-2", name: "Chen Residence", invoiceId: "inv-3", balance: 2764.80, jobName: "Retaining Wall", email: "chen@example.com" },
  { id: "cust-3", name: "Wilson Property", invoiceId: "inv-4", balance: 9180, jobName: "Driveway Extension", email: "wilson@example.com" },
];

const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string; requiresStripe?: boolean }[] = [
  { id: "card", label: "Credit/Debit Card", icon: <CreditCard className="h-5 w-5" />, description: "Visa, Mastercard, Amex", requiresStripe: true },
  { id: "tap-to-pay", label: "Tap to Pay", icon: <Smartphone className="h-5 w-5" />, description: "Contactless payment", requiresStripe: true },
  { id: "cash", label: "Cash", icon: <Banknote className="h-5 w-5" />, description: "Record cash payment" },
  { id: "check", label: "Check", icon: <FileText className="h-5 w-5" />, description: "Record check payment" },
  { id: "ach", label: "ACH Transfer", icon: <Building2 className="h-5 w-5" />, description: "Bank transfer", requiresStripe: true },
];

export default function ChargePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedInvoice = location.state?.invoice;
  const preselectedMethod = location.state?.selectedMethod as PaymentMethod | undefined;
  const {
    status: stripeStatus,
    isReady: stripeReady,
    createPaymentSession,
    createTapToPayPaymentSession,
    startOnboarding,
  } = useStripeConnect();

  const customPreselectedCustomer =
    preselectedInvoice &&
    !customersWithBalance.find((c) => c.name === preselectedInvoice.customerName)
      ? {
          id: preselectedInvoice.customerId || `prefilled-${preselectedInvoice.id || preselectedInvoice.invoiceId || "invoice"}`,
          name: preselectedInvoice.customerName,
          invoiceId: preselectedInvoice.invoiceId || preselectedInvoice.id,
          balance: Number(preselectedInvoice.balanceDue || 0),
          jobName: preselectedInvoice.jobName || "Invoice Payment",
          email: preselectedInvoice.email || "",
        }
      : null;
  const availableCustomers = customPreselectedCustomer
    ? [customPreselectedCustomer, ...customersWithBalance]
    : customersWithBalance;

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(
    preselectedInvoice
      ? availableCustomers.find(c => c.name === preselectedInvoice.customerName)?.id || customPreselectedCustomer?.id || null
      : null
  );
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(preselectedMethod || null);
  const [amount, setAmount] = useState<string>(
    preselectedInvoice ? preselectedInvoice.balanceDue.toString() : ""
  );
  const [step, setStep] = useState<"select" | "method" | "details" | "confirm">(
    preselectedInvoice && preselectedMethod ? "details" : preselectedInvoice ? "method" : "select"
  );
  const [processingCard, setProcessingCard] = useState(false);
  const [creatingTapToPaySession, setCreatingTapToPaySession] = useState(false);
  const [tapToPaySession, setTapToPaySession] = useState<TapToPayPaymentSessionResponse | null>(null);
  const [tapToPayHandoffUrl, setTapToPayHandoffUrl] = useState<string | null>(null);
  const supportsDirectMobileHandoff = isDirectTapToPayHandoffSupported(
    typeof navigator === "undefined" ? undefined : navigator.userAgent,
  );

  const selectedCustomerData = availableCustomers.find(c => c.id === selectedCustomer);
  const parsedAmount = Number(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customerId);
    setTapToPaySession(null);
    setTapToPayHandoffUrl(null);
      const customer = availableCustomers.find(c => c.id === customerId);
    if (customer) {
      setAmount(customer.balance.toString());
    }
    setStep("method");
  };

  const handleTapToPay = (customerId: string) => {
    setSelectedCustomer(customerId);
    setTapToPaySession(null);
    setTapToPayHandoffUrl(null);
    const customer = availableCustomers.find(c => c.id === customerId);
    if (customer) {
      setAmount(customer.balance.toString());
    }
    setSelectedMethod("tap-to-pay");
    setStep("details");
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method !== "tap-to-pay") {
      setTapToPaySession(null);
      setTapToPayHandoffUrl(null);
    }
    setStep("details");
  };

  const handleCardPayment = async () => {
    if (!selectedCustomerData || !amount) return;
    
    setProcessingCard(true);
    try {
      const result = await createPaymentSession({
        amount: parseFloat(amount),
        invoiceId: selectedCustomerData.invoiceId,
        customerId: selectedCustomerData.id,
        customerEmail: selectedCustomerData.email,
        customerName: selectedCustomerData.name,
        description: `Payment for ${selectedCustomerData.jobName}`,
      });

      if (result?.url) {
        window.open(result.url, "_blank");
        toast.success("Payment page opened in new tab");
      }
    } finally {
      setProcessingCard(false);
    }
  };

  const handleTapToPayHandoff = async () => {
    if (!selectedCustomerData || !hasValidAmount) return;

    setCreatingTapToPaySession(true);
    try {
      const session = await createTapToPayPaymentSession({
        amount: parsedAmount,
        invoiceId: selectedCustomerData.invoiceId,
        customerId: selectedCustomerData.id,
        customerEmail: selectedCustomerData.email,
        customerName: selectedCustomerData.name,
        description: `Payment for ${selectedCustomerData.jobName}`,
      });

      if (!session) {
        return;
      }

      const handoffUrl = createTapToPayDeepLink({
        invoiceId: selectedCustomerData.invoiceId,
        customerId: selectedCustomerData.id,
        amount: parsedAmount,
        paymentIntentId: session.paymentIntentId,
        paymentId: session.paymentId ?? undefined,
      });

      setTapToPaySession(session);
      setTapToPayHandoffUrl(handoffUrl);
      toast.success("Tap to Pay handoff ready");
    } finally {
      setCreatingTapToPaySession(false);
    }
  };

  const handleConfirmPayment = () => {
    setStep("confirm");
    // Simulate payment processing for non-card payments
    setTimeout(() => {
      navigate("/payments", { state: { paymentSuccess: true } });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Charge Payment" showBack backTo="/payments" />

      <main className="px-4 py-4">
        {/* Step 1: Select Customer */}
        {step === "select" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Customer</h2>
              <p className="text-sm text-muted-foreground">Choose a customer with an open balance</p>
            </div>

            <div className="space-y-3">
              {availableCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={cn(
                    "w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all",
                    selectedCustomer === customer.id && "ring-2 ring-primary"
                  )}
                >
                  <button
                    onClick={() => handleCustomerSelect(customer.id)}
                    className="w-full active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary">
                          <User className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-foreground">{customer.name}</h3>
                          <p className="text-sm text-muted-foreground">{customer.jobName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          ${customer.balance.toLocaleString()}
                        </p>
                        <p className="text-2xs text-muted-foreground">Balance due</p>
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-3 gap-2"
                    onClick={() => handleTapToPay(customer.id)}
                  >
                    <Smartphone className="h-4 w-4" />
                    Tap to Pay
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Payment Method */}
        {step === "method" && selectedCustomerData && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Payment Method</h2>
              <p className="text-sm text-muted-foreground">
                Charging {selectedCustomerData.name} • ${parseFloat(amount).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className={cn(
                    "w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all",
                    selectedMethod === method.id && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      {method.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{method.label}</h3>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => setStep("select")}>
              Back to Customer Selection
            </Button>
          </div>
        )}

        {/* Step 3: Payment Details */}
        {step === "details" && selectedCustomerData && selectedMethod && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Payment Details</h2>
              <p className="text-sm text-muted-foreground">
                {selectedCustomerData.name} • {paymentMethods.find(m => m.id === selectedMethod)?.label}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (selectedMethod === "tap-to-pay") {
                      setTapToPaySession(null);
                      setTapToPayHandoffUrl(null);
                    }
                  }}
                  className="pl-10 text-lg font-semibold"
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Balance: ${selectedCustomerData.balance.toLocaleString()}
              </p>
            </div>

            {/* Card Payment via Stripe */}
            {selectedMethod === "card" && (
              <div className="card-elevated rounded-lg p-4">
                {stripeReady ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-[hsl(var(--status-confirmed-bg))]">
                        <Check className="h-5 w-5 text-[hsl(var(--status-confirmed))]" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Stripe Connected</p>
                        <p className="text-sm text-muted-foreground">Ready to accept payments</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Customer will be redirected to a secure Stripe checkout page.
                    </p>
                    <Button 
                      className="w-full gap-2" 
                      onClick={handleCardPayment}
                      disabled={processingCard || !amount || parseFloat(amount) <= 0}
                    >
                      {processingCard ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Charge ${amount ? parseFloat(amount).toLocaleString() : "0"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-[hsl(var(--status-attention-bg))]">
                        <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-attention))]" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Stripe Not Connected</p>
                        <p className="text-sm text-muted-foreground">Connect to accept card payments</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your Stripe account to accept credit card payments from customers.
                    </p>
                    <Button 
                      className="w-full gap-2" 
                      onClick={startOnboarding}
                    >
                      <CreditCard className="h-4 w-4" />
                      Connect Stripe Account
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Tap to Pay handoff */}
            {selectedMethod === "tap-to-pay" && (
              <div className="card-elevated rounded-lg p-4">
                {stripeReady ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-[hsl(var(--status-pending-bg))]">
                        <Smartphone className="h-5 w-5 text-[hsl(var(--status-pending))]" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Mobile App Required</p>
                        <p className="text-sm text-muted-foreground">Tap to Pay must continue in the mobile app.</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      This browser creates the Stripe Terminal payment session, then hands off the payment to the mobile app for card collection.
                    </p>
                    {!supportsDirectMobileHandoff && (
                      <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                        This desktop browser can only prepare the handoff. Open the generated link from a supported iPhone or Android device running the LeadSig Tap to Pay app.
                      </div>
                    )}

                    {tapToPayHandoffUrl ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs break-all text-muted-foreground">
                          {tapToPayHandoffUrl}
                        </div>
                        <a
                          href={tapToPayHandoffUrl}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                        >
                          Open in mobile app
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Payment session {tapToPaySession?.paymentIntentId} is ready to continue on mobile.
                        </p>
                      </div>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={handleTapToPayHandoff}
                        disabled={creatingTapToPaySession || !hasValidAmount}
                      >
                        {creatingTapToPaySession ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Smartphone className="h-4 w-4" />
                        )}
                        Generate mobile handoff
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-[hsl(var(--status-attention-bg))]">
                        <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-attention))]" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Stripe Not Connected</p>
                        <p className="text-sm text-muted-foreground">Connect to hand off Tap to Pay sessions</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your Stripe account before you create a mobile Tap to Pay handoff.
                    </p>
                    <Button 
                      className="w-full gap-2" 
                      onClick={startOnboarding}
                    >
                      <CreditCard className="h-4 w-4" />
                      Connect Stripe Account
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Cash/Check Details */}
            {(selectedMethod === "cash" || selectedMethod === "check") && (
              <div className="space-y-4">
                {selectedMethod === "check" && (
                  <div className="space-y-2">
                    <Label htmlFor="checkNumber">Check Number</Label>
                    <Input id="checkNumber" placeholder="Enter check number" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input id="notes" placeholder="Add payment notes" />
                </div>
              </div>
            )}

            {/* ACH Details */}
            {selectedMethod === "ach" && (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[hsl(var(--status-pending-bg))]">
                    <Building2 className="h-5 w-5 text-[hsl(var(--status-pending))]" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">ACH Transfer</p>
                    <p className="text-sm text-muted-foreground">Bank account required</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect a payment processor to accept ACH transfers.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("method")}>
                Back
              </Button>
              {(selectedMethod === "cash" || selectedMethod === "check") && (
              <Button
                className="flex-1" 
                onClick={handleConfirmPayment}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Record Payment
              </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirm" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="p-4 rounded-full bg-[hsl(var(--status-confirmed-bg))] mb-4">
              <Check className="h-12 w-12 text-[hsl(var(--status-confirmed))]" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Recorded</h2>
            <p className="text-muted-foreground mb-1">
              ${parseFloat(amount).toLocaleString()} from {selectedCustomerData?.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Receipt has been generated and attached to the job record.
            </p>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
