import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, FileText } from "lucide-react";
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

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: any;
}

export function CreateInvoiceModal({ open, onOpenChange, estimate }: CreateInvoiceModalProps) {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [existingInvoicesTotal, setExistingInvoicesTotal] = useState(0);

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

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setDueDate(defaultDueDate.toISOString().split("T")[0]);
    setNotes("");
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
      const activeLineItems = estimate.line_items.filter(
        (item: any) => !item.is_change_order || item.change_order_type !== "deleted"
      );

      const ratio = invoiceAmount / estimateTotal;
      const adjustedLineItems = activeLineItems.map((item: any) => ({
        ...item,
        total: parseFloat(item.total.toString()) * ratio,
        quantity: parseFloat(item.quantity.toString()) * ratio,
      }));

      const subtotal = adjustedLineItems.reduce((sum: number, item: any) => sum + item.total, 0);
      const tax = subtotal * parseFloat(estimate.tax_rate.toString());
      const discount = parseFloat(estimate.discount.toString()) * ratio;

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
          subtotal,
          tax_rate: estimate.tax_rate,
          tax,
          discount,
          total: invoiceAmount,
          balance_due: invoiceAmount,
          notes: notes || estimate.notes,
          status: sendViaStripe ? "sent" : "draft",
          sent_at: sendViaStripe ? new Date().toISOString() : null,
          due_date: dueDate,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select("id")
        .single();

      if (invoiceError) throw invoiceError;

      for (const item of adjustedLineItems) {
        await supabase.from("invoice_line_items").insert({
          invoice_id: newInvoice.id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: item.sort_order || 0,
          account_id: currentAccount.id,
        });
      }

      if (sendViaStripe) {
        const { error: stripeError } = await supabase.functions.invoke("stripe-connect-invoice", {
          body: {
            invoiceId: newInvoice.id,
            customerEmail: estimate.customer?.email || undefined,
            customerName: estimate.customer?.name || undefined,
          },
        });

        if (stripeError) {
          toast.error("Invoice created but failed to send via Stripe");
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

  return (
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

              <div className="space-y-2">
                <Label htmlFor="invoice-due-date">Due Date</Label>
                <Input
                  id="invoice-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-notes">Notes</Label>
                <Textarea
                  id="invoice-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional invoice notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleCreateInvoice(false)}
                  disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount}
                >
                  {creating ? "Creating..." : "Save as Draft"}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleCreateInvoice(true)}
                  disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount}
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
  );
}
