import { useState, useEffect, type MouseEvent } from "react";
import { Send, ChevronsUp, ExternalLink, Loader as Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getNextInvoiceNumberSecure } from "@/lib/secureRpc";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { OtherPaymentOptionsModal, type PaymentOption } from "@/components/payments/OtherPaymentOptionsModal";
import { roundCurrencyAmount } from "@/lib/formatter";
import {
  ensureInvoiceForLoggedPayment,
  recordLoggedPaymentAgainstInvoice,
  selectInvoiceForLoggedPayment,
} from "@/lib/logPayment";
import { approveLatestEstimateForJob } from "@/lib/estimateApproval";

interface ExistingInvoice {
  id: string;
  total: number;
  status: string;
  created_at: string;
  balance_due: number | null;
  customer_id: string | null;
  lead_id: string | null;
  account_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
}

interface JobInvoiceCardProps {
  jobId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  estimateTotal?: number | null;
  openLogPaymentSignal?: number;
  grouped?: boolean;
}

export function JobInvoiceCard({
  jobId,
  customerEmail,
  customerName,
  estimateTotal,
  openLogPaymentSignal = 0,
  grouped = false,
}: JobInvoiceCardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();
  const [invoices, setInvoices] = useState<ExistingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [estimateStatus, setEstimateStatus] = useState<string | null>(null);
  const [approvingEstimate, setApprovingEstimate] = useState(false);
  const [showLogPaymentModal, setShowLogPaymentModal] = useState(false);
  const [showAllInvoicesModal, setShowAllInvoicesModal] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const taxRate = (currentAccount?.default_tax_rate || 0) / 100;
  const invoiceAmount = parseFloat(amount) || 0;
  const taxAmount = invoiceAmount * taxRate;
  const totalWithTax = invoiceAmount + taxAmount;

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("id, total, status, created_at, balance_due, customer_id, lead_id, account_id, stripe_invoice_id, stripe_invoice_url")
      .eq("lead_id", jobId)
      .order("created_at", { ascending: false });
    setInvoices(data || []);

    const { data: estimate } = await supabase
      .from("estimates")
      .select("status")
      .eq("job_id", jobId)
      .maybeSingle();
    setEstimateStatus(estimate?.status || null);

    setLoading(false);
  };

  const handleApproveEstimateManually = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (approvingEstimate) return;
    setApprovingEstimate(true);
    try {
      await approveLatestEstimateForJob(jobId);
      toast.success("Estimate marked as approved");
      await fetchInvoices();
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error) {
      console.error("Failed to approve estimate from invoice card:", error);
      toast.error("Failed to approve estimate");
    } finally {
      setApprovingEstimate(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [jobId]);

  useEffect(() => {
    if (openLogPaymentSignal <= 0) return;
    setShowLogPaymentModal(true);
  }, [openLogPaymentSignal]);

  useEffect(() => {
    if (dialogOpen && estimateTotal !== null && estimateTotal !== undefined) {
      const totalInvoiced = roundCurrencyAmount(invoices.reduce((sum, inv) => sum + Number(inv.total), 0));
      const remaining = roundCurrencyAmount(estimateTotal - totalInvoiced);
      setAmount(remaining > 0 ? remaining.toFixed(2) : "");
    }
  }, [dialogOpen, estimateTotal, invoices]);

  const totalInvoiced = roundCurrencyAmount(invoices.reduce((sum, inv) => sum + Number(inv.total), 0));
  const totalPaid = roundCurrencyAmount(
    invoices.reduce((sum, inv) => sum + Math.max(Number(inv.total || 0) - Number(inv.balance_due || 0), 0), 0),
  );
  const totalToInvoice = roundCurrencyAmount(estimateTotal ?? 0);
  const remainingAmount = estimateTotal !== null && estimateTotal !== undefined
    ? roundCurrencyAmount(estimateTotal - totalInvoiced)
    : null;
  const sentInvoicesCount = invoices.filter((invoice) => invoice.status !== "draft").length;
  const formattedTotalInvoiced = totalInvoiced.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedTotalToInvoice = totalToInvoice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleOpenDialog = () => {
    setTitle("");
    setDescription("");
    setAmount(estimateTotal !== null && estimateTotal !== undefined
      ? roundCurrencyAmount(estimateTotal).toFixed(2)
      : "");
    setDialogOpen(true);
  };

  const handleSendInvoice = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    const invoiceAmount = parseFloat(amount);

    if (!title.trim()) {
      toast.error("Please enter an invoice title");
      return;
    }

    if (!invoiceAmount || invoiceAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (
      estimateTotal !== null &&
      estimateTotal !== undefined &&
      roundCurrencyAmount(totalInvoiced + invoiceAmount) > roundCurrencyAmount(estimateTotal)
    ) {
      toast.error(`Invoice amount exceeds estimate. Maximum remaining: $${remainingAmount?.toLocaleString()}`);
      return;
    }

    if (!customerEmail) {
      toast.error("Customer must have an email address to receive invoices. Please add an email to the customer profile.");
      return;
    }

    setSending(true);
    try {
      const { data: job } = await supabase
        .from("leads")
        .select("customer_id")
        .eq("id", jobId)
        .single();

      const { data: estimate } = await supabase
        .from("estimates")
        .select("id, status")
        .eq("job_id", jobId)
        .maybeSingle();

      if (!estimate) {
        toast.error("No estimate found for this job. Please create an estimate first.");
        setSending(false);
        return;
      }

      if (estimate.status !== "accepted") {
        toast.error("The estimate must be approved before you can send an invoice.");
        setSending(false);
        return;
      }

      const invoiceNumber = await getNextInvoiceNumberSecure(currentAccount.id);

      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          customer_id: job?.customer_id || null,
          lead_id: jobId,
          estimate_id: estimate.id,
          invoice_number: invoiceNumber || 1,
          subtotal: invoiceAmount,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          total: invoiceAmount,
          balance_due: invoiceAmount,
          notes: description.trim() || null,
          status: "draft",
          due_date: dueDate,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select("id")
        .single();

      if (invoiceError) throw invoiceError;

      await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        name: title.trim(),
        description: description.trim() || null,
        quantity: 1,
        unit: "item",
        unit_price: invoiceAmount,
        total: invoiceAmount,
        sort_order: 0,
        account_id: currentAccount.id,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Session expired. Please sign in again.");
        setSending(false);
        return;
      }

      const { data: invokeData, error: stripeError } = await supabase.functions.invoke("stripe-connect-invoice", {
        body: {
          invoiceId: newInvoice.id,
          customerEmail: customerEmail || undefined,
          customerName: customerName || undefined,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (stripeError) {
        console.error("Stripe invoice error:", stripeError);
        const errorMessage = invokeData?.error || stripeError.message || "Unknown error";
        toast.error(`Failed to send invoice: ${errorMessage}`);
      } else {
        toast.success("Invoice created and sent via Stripe");
      }

      setDialogOpen(false);
      fetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (error) {
      console.error("Invoice creation error:", error);
      toast.error("Failed to create invoice");
    } finally {
      setSending(false);
    }
  };

  const handleRecordPayment = async (method: PaymentOption, paymentAmount: number) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    setRecordingPayment(true);
    try {
      const { data: job } = await supabase
        .from("leads")
        .select("customer_id")
        .eq("id", jobId)
        .single();

      if (!job?.customer_id) {
        toast.error("Customer not found");
        setRecordingPayment(false);
        return;
      }

      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("id, balance_due, status, created_at")
        .eq("lead_id", jobId)
        .order("created_at", { ascending: false })
        .limit(10);

      const existingInvoice = selectInvoiceForLoggedPayment(existingInvoices || []);

      const methodLabel = method === "ach"
        ? "ACH"
        : method.charAt(0).toUpperCase() + method.slice(1);

      const invoiceId = await ensureInvoiceForLoggedPayment({
        supabase,
        existingInvoiceId: existingInvoice?.id ?? null,
        customerId: job.customer_id,
        jobId,
        accountId: currentAccount.id,
        userId: user.id,
        amount: paymentAmount,
        methodLabel,
      });

      await recordLoggedPaymentAgainstInvoice({
        supabase,
        invoice: existingInvoice?.id
          ? {
              id: existingInvoice.id,
              customer_id: existingInvoice.customer_id ?? job.customer_id,
              lead_id: existingInvoice.lead_id ?? jobId,
              account_id: existingInvoice.account_id ?? currentAccount.id,
              balance_due: existingInvoice.balance_due,
              stripe_invoice_id: existingInvoice.stripe_invoice_id ?? null,
            }
          : {
              id: invoiceId,
              customer_id: job.customer_id,
              lead_id: jobId,
              account_id: currentAccount.id,
              balance_due: paymentAmount,
              stripe_invoice_id: null,
            },
        paymentAmount,
        method,
        methodLabel,
        userId: user.id,
      });

      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowLogPaymentModal(false);
      toast.success(`${method.charAt(0).toUpperCase() + method.slice(1)} payment of $${paymentAmount.toLocaleString()} recorded`);
      fetchInvoices();
    } catch (error) {
      console.error("Payment recording error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleOpenTapToPay = (paymentAmount: number) => {
    const openTapToPay = async () => {
      if (!user || !currentAccount) {
        toast.error("Authentication required");
        return;
      }

      try {
        const { data: job } = await supabase
          .from("leads")
          .select("customer_id, name")
          .eq("id", jobId)
          .single();

        if (!job?.customer_id) {
          toast.error("Customer not found");
          return;
        }

        navigate("/payments/charge", {
          state: {
            invoice: {
              customerId: job.customer_id,
              customerName: customerName || "Unknown",
              balanceDue: paymentAmount,
              jobId,
              jobName: job.name || "Job Payment",
              email: customerEmail || "",
            },
            selectedMethod: "tap-to-pay",
          },
        });
      } catch (error) {
        console.error("Tap to Pay invoice preparation error:", error);
        toast.error("Failed to prepare Tap to Pay");
      }
    };

    void openTapToPay();
  };

  const handleOpenInPersonPayment = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    const openInvoice = selectInvoiceForLoggedPayment(invoices);
    let invoiceId = openInvoice?.id || null;
    let invoiceCustomerId = openInvoice?.customer_id || null;
    let invoiceBalanceDue = Number(openInvoice?.balance_due || 0);

    if (!invoiceId || invoiceBalanceDue <= 0) {
      const amountToInvoice = roundCurrencyAmount(Number(remainingAmount ?? totalToInvoice));
      if (!amountToInvoice || amountToInvoice <= 0) {
        toast.error("No remaining balance available to charge.");
        return;
      }

      const { data: jobRecord, error: jobError } = await supabase
        .from("leads")
        .select("customer_id")
        .eq("id", jobId)
        .single();

      if (jobError || !jobRecord?.customer_id) {
        toast.error("This job is missing a customer. Update the customer before charging.");
        return;
      }

      const { data: estimate } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();

      const invoiceNumber = await getNextInvoiceNumberSecure(currentAccount.id);

      const dueDate = new Date().toISOString().split("T")[0];
      const { data: newInvoice, error: newInvoiceError } = await supabase
        .from("invoices")
        .insert({
          customer_id: jobRecord.customer_id,
          lead_id: jobId,
          estimate_id: estimate?.id || null,
          invoice_number: invoiceNumber || 1,
          subtotal: amountToInvoice,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          total: amountToInvoice,
          balance_due: amountToInvoice,
          notes: "Created for in-person card payment",
          status: "draft",
          due_date: dueDate,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select("id, customer_id, balance_due")
        .single();

      if (newInvoiceError || !newInvoice?.id) {
        console.error("Failed to create in-person payment invoice:", newInvoiceError);
        toast.error("Failed to prepare invoice for in-person payment.");
        return;
      }

      const { error: lineItemError } = await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        name: "In-person card payment",
        description: "In-person card payment",
        quantity: 1,
        unit: "item",
        unit_price: amountToInvoice,
        total: amountToInvoice,
        sort_order: 0,
        account_id: currentAccount.id,
      });

      if (lineItemError) {
        console.error("Failed to create line item for in-person payment invoice:", lineItemError);
        toast.error("Failed to prepare invoice line item.");
        return;
      }

      invoiceId = newInvoice.id;
      invoiceCustomerId = newInvoice.customer_id;
      invoiceBalanceDue = Number(newInvoice.balance_due || amountToInvoice);
      await fetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }

    if (!invoiceCustomerId) {
      toast.error("This invoice is missing a customer. Update the job customer before charging.");
      return;
    }

    setShowLogPaymentModal(false);
    navigate("/payments/charge", {
      state: {
        invoice: {
          id: invoiceId,
          invoiceId,
          customerId: invoiceCustomerId,
          customerName: customerName || "Customer",
          balanceDue: invoiceBalanceDue,
          jobId,
          jobName: customerName || "Invoice Payment",
          email: customerEmail || "",
        },
        selectedMethod: "card",
        returnTo: `/jobs/${jobId}`,
      },
    });
  };

  const statusColors: Record<string, string> = {
    sent: "text-amber-600",
    paid: "text-emerald-600",
    partial: "text-blue-600",
    overdue: "text-destructive",
    draft: "text-muted-foreground",
  };
  const isFullyInvoiced = Boolean(estimateTotal && remainingAmount !== null && remainingAmount <= 0);
  const estimateNeedsApproval = Boolean(estimateStatus && estimateStatus !== "accepted");
  const sendInvoiceDisabled = loading || isFullyInvoiced || estimateNeedsApproval;
  const sendInvoiceHelperText = isFullyInvoiced
    ? "Estimate fully invoiced"
    : estimateNeedsApproval
      ? "The estimate must be approved before sending an invoice"
      : undefined;

  return (
    <>
      <div className="space-y-3">
        <div
          role="button"
          tabIndex={0}
          className={grouped
            ? "p-0 text-foreground cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))]"
            : "rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))"}
          onClick={() => setShowAllInvoicesModal(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setShowAllInvoicesModal(true);
            }
          }}
          aria-label="View all invoices"
        >
          <div className="flex items-center justify-between gap-2">
           <div className="flex gap-2 items-center">
            <ChevronsUp className="w-3 h-3"/>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Invoices</p>
          </div>
            <span className=" inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              View 
            </span>
          </div>

          <div className="mt-2 mb-6">
            <p className="flex items-baseline gap-1 overflow-hidden whitespace-nowrap text-lg font-semibold leading-tight text-foreground sm:text-xl">
              <span className="shrink-0">+{formattedTotalInvoiced}</span>
              <span className="truncate text-xs font-medium text-muted-foreground sm:text-sm">/{formattedTotalToInvoice}</span>
            </p>
            <p className="mt-2 text-muted-foreground text-xs">
              {sentInvoicesCount} {sentInvoicesCount === 1 ? "invoice" : "invoices"} sent
            </p>
          </div>

          <div className="mt-4">
            {estimateTotal && remainingAmount !== null && remainingAmount <= 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Estimate fully invoiced
              </p>
            ) : estimateStatus && estimateStatus !== "accepted" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="flex-1 basis-[220px]"
                    disabled

                    onClick={(event) => event.stopPropagation()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Invoice
                  </Button>
                  <Button
                    className="flex-1 basis-[220px]"
                    variant="outline"
                    disabled
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Log Payment
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  The estimate must be approved before sending an invoice
                </p>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto w-full p-0 text-xs"
                  onClick={handleApproveEstimateManually}
                  disabled={approvingEstimate}
                >
                  {approvingEstimate ? "Approving..." : "Approve Estimate Manually"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1 basis-[220px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenDialog();
                  }}
                  
                  disabled={loading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
                <Button
                  className="flex-1 basis-[220px]"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowLogPaymentModal(true);
                  }}
                  disabled={loading}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Log Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAllInvoicesModal} onOpenChange={setShowAllInvoicesModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>All Invoices</DialogTitle>
            <DialogDescription>
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} for this job
            </DialogDescription>
          </DialogHeader>
          {invoices.length > 0 ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => {
                    setShowAllInvoicesModal(false);
                    navigate(`/payments/invoices/${inv.id}`);
                  }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      ${Number(inv.total).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(inv.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium capitalize ${statusColors[inv.status] || "text-muted-foreground"}`}>
                      {inv.status}
                    </span>
                    {inv.stripe_invoice_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(inv.stripe_invoice_url!, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No invoices yet for this job.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>
              Create and send an invoice for this job.
              {estimateTotal && remainingAmount !== null && (
                <span className="block mt-1 text-foreground font-medium">
                  Remaining: ${remainingAmount.toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-title">Title</Label>
              <Input
                id="invoice-title"
                placeholder="e.g., Full Payment, Deposit, Final Payment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-description">Description (Optional)</Label>
              <Textarea
                id="invoice-description"
                placeholder="Additional details about this invoice"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-amount">Invoice Amount</Label>
              <Input
                id="invoice-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {estimateTotal && remainingAmount !== null && parseFloat(amount) > remainingAmount && (
                <p className="text-sm text-destructive">
                  Amount exceeds remaining estimate balance
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendInvoice} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OtherPaymentOptionsModal
        open={showLogPaymentModal}
        onOpenChange={setShowLogPaymentModal}
        totalAmount={totalToInvoice}
        paidAmount={totalPaid}
        remainingAmount={Math.max(Number(remainingAmount ?? 0), 0)}
        remainingLabel="To Invoice"
        onSendInvoice={() => {
          setShowLogPaymentModal(false);
          handleOpenDialog();
        }}
        sendInvoiceDisabled={sendInvoiceDisabled}
        sendInvoiceHelperText={sendInvoiceHelperText}
        onInPersonPayment={handleOpenInPersonPayment}
        onRecordPayment={handleRecordPayment}
        onOpenTapToPay={handleOpenTapToPay}
        recordingPayment={recordingPayment}
      />
    </>
  );
}
