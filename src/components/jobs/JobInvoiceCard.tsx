import { useState, useEffect } from "react";
import { Send, ExternalLink, Loader as Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface ExistingInvoice {
  id: string;
  total: number;
  status: string;
  created_at: string;
  stripe_invoice_url: string | null;
}

interface JobInvoiceCardProps {
  jobId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  estimateTotal?: number | null;
}

export function JobInvoiceCard({ jobId, customerEmail, customerName, estimateTotal }: JobInvoiceCardProps) {
  const queryClient = useQueryClient();
  const [invoices, setInvoices] = useState<ExistingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("id, total, status, created_at, stripe_invoice_url")
      .eq("lead_id", jobId)
      .order("created_at", { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [jobId]);

  useEffect(() => {
    if (dialogOpen && estimateTotal) {
      const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const remaining = estimateTotal - totalInvoiced;
      setAmount(remaining > 0 ? remaining.toString() : "");
    }
  }, [dialogOpen, estimateTotal, invoices]);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const remainingAmount = estimateTotal ? estimateTotal - totalInvoiced : null;

  const handleOpenDialog = () => {
    setTitle("");
    setDescription("");
    setAmount(estimateTotal ? estimateTotal.toString() : "");
    setDialogOpen(true);
  };

  const handleSendInvoice = async () => {
    const invoiceAmount = parseFloat(amount);

    if (!title.trim()) {
      toast.error("Please enter an invoice title");
      return;
    }

    if (!invoiceAmount || invoiceAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (estimateTotal && (totalInvoiced + invoiceAmount) > estimateTotal) {
      toast.error(`Invoice amount exceeds estimate. Maximum remaining: $${remainingAmount?.toLocaleString()}`);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-job-invoice", {
        body: {
          jobId,
          lineItems: [{
            name: title.trim(),
            description: description.trim() || undefined,
            quantity: 1,
            unit_price: invoiceAmount,
          }],
          customerEmail: customerEmail || undefined,
          customerName: customerName || undefined,
        },
      });

      if (error) {
        const body = error.context?.body ?? error.body;
        let msg = "Failed to create invoice";
        if (body) {
          try {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            if (parsed?.error) msg = parsed.error;
          } catch { }
        }
        toast.error(msg);
        return;
      }

      toast.success("Invoice created and sent via Stripe");
      setDialogOpen(false);
      fetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSending(false);
    }
  };

  const statusColors: Record<string, string> = {
    sent: "text-amber-600",
    paid: "text-emerald-600",
    partial: "text-blue-600",
    overdue: "text-destructive",
    draft: "text-muted-foreground",
  };

  return (
    <>
      <div className="space-y-3">
        {invoices.length > 0 && (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
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
                      onClick={() => window.open(inv.stripe_invoice_url!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {estimateTotal && remainingAmount !== null && remainingAmount <= 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Estimate fully invoiced
          </p>
        ) : (
          <Button
            className="w-full"
            onClick={handleOpenDialog}
            disabled={loading}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Invoice
          </Button>
        )}
      </div>

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
              <Label htmlFor="invoice-amount">Amount</Label>
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
    </>
  );
}
