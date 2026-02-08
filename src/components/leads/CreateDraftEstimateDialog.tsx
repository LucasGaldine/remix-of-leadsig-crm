import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { type EstimateLineItemInit } from "./LineItemsEstimateDialog";

interface CreateDraftEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    service_type: string | null;
    estimated_value: number | null;
  };
  lineItems: EstimateLineItemInit[];
  onSuccess: () => void;
}

export function CreateDraftEstimateDialog({ open, onOpenChange, lead, lineItems, onSuccess }: CreateDraftEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");

  const estimateTotal = lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || "0");
    const unitPrice = parseFloat(item.unit_price || "0");
    return sum + quantity * unitPrice;
  }, 0);

  const handleCreate = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    setCreating(true);
    const loadingToast = toast.loading("Creating estimate...");

    try {
      let customerId = null;

      if (lead.phone) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", lead.phone)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            address: lead.address || lead.city,
            city: lead.city,
            created_by: user.id,
            account_id: currentAccount.id,
          })
          .select()
          .single();

        if (customerError) throw new Error("Failed to create customer");
        customerId = newCustomer.id;
      }

      if (scheduledDate) {
        const { error: convertError } = await supabase
          .from("leads")
          .update({
            customer_id: customerId,
            estimated_value: estimateTotal,
            status: "job",
            is_estimate_visit: true,
            name: `${lead.name}, Estimate`,
            approval_status: "approved",
          })
          .eq("id", lead.id);

        if (convertError) throw new Error("Failed to convert lead to estimate job");

        await supabase.from("job_schedules").insert({
          lead_id: lead.id,
          scheduled_date: scheduledDate,
          scheduled_time_start: scheduledTimeStart || null,
          scheduled_time_end: scheduledTimeEnd || null,
          created_by: user.id,
          account_id: currentAccount.id,
        });
      } else {
        await supabase
          .from("leads")
          .update({
            customer_id: customerId,
            estimated_value: estimateTotal,
          })
          .eq("id", lead.id);
      }

      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          customer_id: customerId,
          job_id: lead.id,
          subtotal: estimateTotal,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          total: estimateTotal,
          status: "draft",
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (estimateError) throw new Error("Failed to create estimate");

      const lineItemsToInsert = lineItems
        .filter((item) => item.name && item.unit_price)
        .map((item, index) => {
          const quantity = parseFloat(item.quantity || "1");
          const unitPrice = parseFloat(item.unit_price);
          return {
            estimate_id: estimateData.id,
            account_id: currentAccount.id,
            name: item.name,
            description: item.description || null,
            quantity,
            unit: item.unit,
            unit_price: unitPrice,
            total: quantity * unitPrice,
            sort_order: index,
          };
        });

      if (lineItemsToInsert.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw new Error("Failed to create line items");
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: scheduledDate ? "Estimate created with scheduled visit" : "Draft estimate created",
        body: `Estimate created with ${lineItemsToInsert.length} line items totaling $${estimateTotal.toFixed(2)}`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Estimate created!");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });

      const wasScheduled = !!scheduledDate;
      setScheduledDate("");
      setScheduledTimeStart("");
      setScheduledTimeEnd("");
      onOpenChange(false);

      if (wasScheduled) {
        navigate(`/jobs/${lead.id}`);
      } else {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating estimate:", error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to create estimate");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Draft Estimate</DialogTitle>
          <DialogDescription>
            Create an estimate for {lead.name} using the quick estimate breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            {lineItems.map((item, i) => {
              const qty = parseFloat(item.quantity || "0");
              const price = parseFloat(item.unit_price || "0");
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium">${(qty * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              );
            })}
            <div className="border-t border-border pt-2 mt-2 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>${estimateTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Visit (Optional)
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="draft-schedule-date">Date</Label>
                <Input
                  id="draft-schedule-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-schedule-start">Start Time</Label>
                <Input
                  id="draft-schedule-start"
                  type="time"
                  value={scheduledTimeStart}
                  onChange={(e) => setScheduledTimeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-schedule-end">End Time</Label>
                <Input
                  id="draft-schedule-end"
                  type="time"
                  value={scheduledTimeEnd}
                  onChange={(e) => setScheduledTimeEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating..." : "Create Estimate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
