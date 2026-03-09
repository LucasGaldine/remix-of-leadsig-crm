import { useState, useEffect } from "react";
import { DollarSign, Plus, Trash2, Send, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface LineItemInput {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const emptyLineItem = (): LineItemInput => ({
  name: "",
  description: "",
  quantity: "1",
  unitPrice: "",
});

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
}

export function JobInvoiceCard({ jobId, customerEmail, customerName }: JobInvoiceCardProps) {
  const queryClient = useQueryClient();
  const [invoices, setInvoices] = useState<ExistingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([emptyLineItem()]);

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

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: keyof LineItemInput, value: string) => {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li)));
  };

  const subtotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.quantity) || 0;
    const price = parseFloat(li.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSendInvoice = async () => {
    const validItems = lineItems.filter((li) => li.name.trim() && parseFloat(li.unitPrice) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one line item with a name and price");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-job-invoice", {
        body: {
          jobId,
          lineItems: validItems.map((li) => ({
            name: li.name.trim(),
            description: li.description.trim() || undefined,
            quantity: parseFloat(li.quantity) || 1,
            unit_price: parseFloat(li.unitPrice),
          })),
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
      setLineItems([emptyLineItem()]);
      setShowForm(false);
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
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-secondary">
          <DollarSign className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Invoices</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Existing invoices */}
      {invoices.length > 0 && (
        <div className="space-y-2 mb-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
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
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(inv.stripe_invoice_url!, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New invoice form */}
      {showForm ? (
        <div className="space-y-3 border-t border-border pt-3">
          {lineItems.map((li, idx) => (
            <div key={idx} className="space-y-2 p-2 bg-secondary/30 rounded-md">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Item {idx + 1}</Label>
                {lineItems.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeLineItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Item name"
                value={li.name}
                onChange={(e) => updateLineItem(idx, "name", e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Description (optional)"
                value={li.description}
                onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(idx, "quantity", e.target.value)}
                  className="h-8 text-sm w-20"
                />
                <Input
                  type="number"
                  placeholder="Unit price"
                  value={li.unitPrice}
                  onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)}
                  className="h-8 text-sm flex-1"
                />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full" onClick={addLineItem}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
          </Button>

          {subtotal > 0 && (
            <p className="text-sm font-medium text-right text-foreground">
              Subtotal: ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowForm(false); setLineItems([emptyLineItem()]); }}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1 gap-1" onClick={handleSendInvoice} disabled={sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Sending..." : "Send Invoice"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Invoice
        </Button>
      )}
    </div>
  );
}
