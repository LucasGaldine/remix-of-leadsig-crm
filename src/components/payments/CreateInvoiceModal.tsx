import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, FileText, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CircleAlert as AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OtherPaymentOptionsModal, type PaymentOption } from "@/components/payments/OtherPaymentOptionsModal";

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: any;
}

export function CreateInvoiceModal({ open, onOpenChange, estimate }: CreateInvoiceModalProps) {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [existingInvoicesTotal, setExistingInvoicesTotal] = useState(0);
  const [showLogPaymentModal, setShowLogPaymentModal] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    if (!open || !estimate) return;

    const fetchExistingInvoices = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total")
        .eq("estimate_id", estimate.id);

      if (error) return;

      const total = data.reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);
      setExistingInvoicesTotal(total);
    };

    fetchExistingInvoices();
  }, [open, estimate?.id]);

  useEffect(() => {
    if (!open || !estimate) return;

    const remaining = parseFloat(estimate.total.toString()) - existingInvoicesTotal;
    setAmount(remaining.toFixed(2));
    setTitle("");
    setDescription("");
  }, [open, estimate?.id, existingInvoicesTotal]);

  if (!estimate) return null;

  const estimateTotal = parseFloat(estimate.total.toString());
  const remainingAmount = estimateTotal - existingInvoicesTotal;
  const invoiceAmount = parseFloat(amount) || 0;

  const handleCreateInvoice = async (sendViaStripe = false) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter an invoice title");
      return;
    }

    if (invoiceAmount <= 0) {
      toast.error("Invoice amount must be greater than 0");
      return;
    }

    if (invoiceAmount > remainingAmount) {
      toast.error(`Invoice amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`);
      return;
    }

    if (sendViaStripe && !estimate.customer?.email) {
      toast.error("Customer must have an email address to receive invoices. Please add an email to the customer profile.");
      return;
    }

    setCreating(true);
    try {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const invoiceNumber = await supabase.rpc("get_next_invoice_number", {
        p_account_id: currentAccount.id,
      });

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          customer_id: estimate.customer?.id,
          lead_id: estimate.job?.id,
          estimate_id: estimate.id,
          invoice_number: invoiceNumber.data || 1,
          subtotal: invoiceAmount,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          total: invoiceAmount,
          balance_due: invoiceAmount,
          notes: description.trim() || null,
          status: sendViaStripe ? "sent" : "draft",
          sent_at: sendViaStripe ? new Date().toISOString() : null,
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

      if (sendViaStripe) {
        const { data: invokeData, error: stripeError } = await supabase.functions.invoke("stripe-connect-invoice", {
          body: {
            invoiceId: newInvoice.id,
            customerEmail: estimate.customer?.email || undefined,
            customerName: estimate.customer?.name || undefined,
          },
        });

        if (stripeError) {
          const errorMessage = invokeData?.error || stripeError.message || "Unknown error";
          toast.error(`Invoice created but failed to send via Stripe: ${errorMessage}`);
        } else {
          toast.success("Invoice created and sent via Stripe");
        }
      } else {
        toast.success("Invoice created successfully");
      }

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["estimate", estimate.id] });

      onOpenChange(false);
      navigate(`/payments/invoices/${newInvoice.id}`);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  const handleRecordPayment = async (method: PaymentOption, paymentAmount: number) => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    setRecordingPayment(true);
    try {
      const customerId = estimate.customer?.id;
      if (!customerId) {
        toast.error("Customer not found");
        setRecordingPayment(false);
        return;
      }

      const dueDate = new Date().toISOString().split("T")[0];

      const invoiceNumber = await supabase.rpc("get_next_invoice_number", {
        p_account_id: currentAccount.id,
      });

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          customer_id: customerId,
          lead_id: estimate.job?.id,
          estimate_id: estimate.id,
          invoice_number: invoiceNumber.data || 1,
          subtotal: paymentAmount,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          total: paymentAmount,
          balance_due: 0,
          notes: `Payment received via ${method}`,
          status: "paid",
          paid_at: new Date().toISOString(),
          due_date: dueDate,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select("id")
        .single();

      if (invoiceError) {
        console.error("Invoice creation error:", invoiceError);
        toast.error("Failed to create invoice");
        setRecordingPayment(false);
        return;
      }

      await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        name: title.trim() || `Payment - ${method.charAt(0).toUpperCase() + method.slice(1)}`,
        description: description.trim() || `Payment received via ${method}`,
        quantity: 1,
        unit: "item",
        unit_price: paymentAmount,
        total: paymentAmount,
        sort_order: 0,
        account_id: currentAccount.id,
      });

      const { error: paymentError } = await supabase.from("payments").insert({
        invoice_id: newInvoice.id,
        lead_id: estimate.job?.id,
        customer_id: customerId,
        amount: paymentAmount,
        method,
        status: "completed",
        processed_by: user.id,
        account_id: currentAccount.id,
      });

      if (paymentError) {
        console.error("Payment insert error:", paymentError);
        toast.error("Failed to record payment");
        setRecordingPayment(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["estimate", estimate.id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

      setShowLogPaymentModal(false);
      onOpenChange(false);
      toast.success(`${method.charAt(0).toUpperCase() + method.slice(1)} payment of $${paymentAmount.toLocaleString()} recorded`);
    } catch (error) {
      console.error("Payment recording error:", error);
      toast.error("Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Invoice
            </DialogTitle>
            <DialogDescription>
              Create an invoice from this estimate
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimate Total</span>
                <span className="font-medium">${estimateTotal.toFixed(2)}</span>
              </div>
              {existingInvoicesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Invoiced</span>
                  <span className="font-medium">${existingInvoicesTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold">${remainingAmount.toFixed(2)}</span>
              </div>
            </div>

            {remainingAmount <= 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This estimate has been fully invoiced.
                </AlertDescription>
              </Alert>
            ) : (
              <>
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    max={remainingAmount}
                    step="0.01"
                  />
                  {invoiceAmount > remainingAmount && (
                    <p className="text-sm text-destructive">
                      Amount exceeds remaining balance
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => setShowLogPaymentModal(true)}
                    disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount}
                  >
                    <DollarSign className="h-4 w-4" />
                    Log Payment
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleCreateInvoice(true)}
                    disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount || !title.trim()}
                  >
                    <CreditCard className="h-4 w-4" />
                    {creating ? "Creating..." : "Send via Stripe"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OtherPaymentOptionsModal
        open={showLogPaymentModal}
        onOpenChange={setShowLogPaymentModal}
        totalAmount={invoiceAmount}
        onRecordPayment={handleRecordPayment}
        recordingPayment={recordingPayment}
      />
    </>
  );
}
