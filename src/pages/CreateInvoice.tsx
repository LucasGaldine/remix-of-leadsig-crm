import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEstimate } from "@/hooks/useEstimates";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get("estimateId");
  const { data: estimate, isLoading } = useEstimate(estimateId || undefined);
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [existingInvoicesTotal, setExistingInvoicesTotal] = useState(0);
  const [sendToStripe, setSendToStripe] = useState(false);

  useEffect(() => {
    const fetchExistingInvoices = async () => {
      if (!estimateId) return;

      const { data, error } = await supabase
        .from("invoices")
        .select("total")
        .eq("estimate_id", estimateId);

      if (error) {
        console.error("Error fetching existing invoices:", error);
        return;
      }

      const total = data.reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);
      setExistingInvoicesTotal(total);
    };

    fetchExistingInvoices();
  }, [estimateId]);

  useEffect(() => {
    if (estimate && !amount) {
      const remaining = parseFloat(estimate.total.toString()) - existingInvoicesTotal;
      setAmount(remaining.toFixed(2));
    }
  }, [estimate, existingInvoicesTotal, amount]);

  useEffect(() => {
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setDueDate(defaultDueDate.toISOString().split("T")[0]);
  }, []);

  if (!estimateId) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Create Invoice" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">No estimate selected</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Create Invoice" showBack backTo="/payments" />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="Create Invoice" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Estimate not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const estimateTotal = parseFloat(estimate.total.toString());
  const remainingAmount = estimateTotal - existingInvoicesTotal;
  const invoiceAmount = parseFloat(amount) || 0;

  const handleCreateInvoice = async () => {
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

      const subtotal = adjustedLineItems.reduce((sum, item) => sum + item.total, 0);
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
          status: sendToStripe ? "sent" : "draft",
          sent_at: sendToStripe ? new Date().toISOString() : null,
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

      if (sendToStripe) {
        const { error: stripeError } = await supabase.functions.invoke("stripe-connect-invoice", {
          body: {
            invoiceId: newInvoice.id,
            customerEmail: estimate.customer?.email || undefined,
            customerName: estimate.customer?.name || undefined,
          },
        });

        if (stripeError) {
          console.error("Stripe invoice error:", stripeError);
          toast.error("Invoice created but failed to send via Stripe");
        } else {
          toast.success("Invoice created and sent via Stripe");
        }
      } else {
        toast.success("Invoice created successfully");
      }

      setSendToStripe(false);

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });

      navigate(`/payments/invoices/${newInvoice.id}`);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Create Invoice" showBack backTo={`/payments/estimates/${estimateId}`} />

      <div className="px-4 py-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Estimate Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{estimate.customer?.name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-medium">{estimate.job?.name || "Unknown"}</p>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Estimate Total</span>
                <span className="font-medium">${estimateTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Already Invoiced</span>
                <span className="font-medium">${existingInvoicesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold text-lg">${remainingAmount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {remainingAmount <= 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This estimate has been fully invoiced. No additional invoices can be created.
            </AlertDescription>
          </Alert>
        )}

        {remainingAmount > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
                <CardDescription>
                  Create an invoice for all or part of the estimate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Invoice Amount *</Label>
                  <Input
                    id="amount"
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
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional invoice notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={handleCreateInvoice}
                disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount}
              >
                {creating ? "Creating..." : "Save as Draft"}
              </Button>
              <Button
                className="flex-1 h-14 gap-2"
                onClick={() => {
                  setSendToStripe(true);
                  handleCreateInvoice();
                }}
                disabled={creating || invoiceAmount <= 0 || invoiceAmount > remainingAmount}
              >
                <CreditCard className="h-4 w-4" />
                {creating ? "Creating..." : "Send via Stripe"}
              </Button>
            </div>
          </>
        )}
      </div>

      <MobileNav />
    </div>
  );
}
