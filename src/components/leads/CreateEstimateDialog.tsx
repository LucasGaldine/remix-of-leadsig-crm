import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LineItemsEstimateDialog } from "./LineItemsEstimateDialog";

interface CreateEstimateDialogProps {
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
  onSuccess: () => void;
}

export function CreateEstimateDialog({ open, onOpenChange, lead, onSuccess }: CreateEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const [scheduling, setScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [lineItemsOpen, setLineItemsOpen] = useState(false);

  const handleSchedule = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    if (!scheduledDate) {
      toast.error("Please select a date for the estimate visit");
      return;
    }

    setScheduling(true);
    const loadingToast = toast.loading("Scheduling estimate...");

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

      await supabase
        .from("leads")
        .update({ customer_id: customerId })
        .eq("id", lead.id);

      const { data: estimateJob, error: estimateJobError } = await supabase
        .from("leads")
        .insert({
          name: `${lead.name}, Estimate`,
          status: "job",
          service_type: lead.service_type,
          address: lead.address,
          customer_id: customerId,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (estimateJobError) throw new Error("Failed to create estimate job");

      const { error: scheduleError } = await supabase
        .from("job_schedules")
        .insert({
          lead_id: estimateJob.id,
          scheduled_date: scheduledDate,
          scheduled_time_start: scheduledTimeStart || null,
          scheduled_time_end: scheduledTimeEnd || null,
          created_by: user.id,
          account_id: currentAccount.id,
        });

      if (scheduleError) throw new Error("Failed to schedule estimate visit");

      await supabase
        .from("leads")
        .update({ estimate_job_id: estimateJob.id })
        .eq("id", lead.id);

      const { data: existingEstimate } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", lead.id)
        .maybeSingle();

      if (!existingEstimate) {
        await supabase
          .from("estimates")
          .insert({
            customer_id: customerId,
            job_id: lead.id,
            subtotal: lead.estimated_value || 0,
            tax_rate: 0,
            tax: 0,
            discount: 0,
            total: lead.estimated_value || 0,
            status: "draft",
            created_by: user.id,
            account_id: currentAccount.id,
          });
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: "Estimate visit scheduled",
        body: `Estimate visit scheduled for ${scheduledDate}.`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Estimate visit scheduled!");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error scheduling estimate:", error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "Failed to schedule estimate");
    } finally {
      setScheduling(false);
    }
  };

  const handleCreateEstimateClick = () => {
    onOpenChange(false);
    setLineItemsOpen(true);
  };

  const handleLineItemsSuccess = () => {
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Estimate</DialogTitle>
            <DialogDescription>
              Schedule an estimate visit for {lead.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visit Date & Time
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="schedule-date">Date *</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-start">Start Time</Label>
                  <Input
                    id="schedule-start"
                    type="time"
                    value={scheduledTimeStart}
                    onChange={(e) => setScheduledTimeStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-end">End Time</Label>
                  <Input
                    id="schedule-end"
                    type="time"
                    value={scheduledTimeEnd}
                    onChange={(e) => setScheduledTimeEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleCreateEstimateClick}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-4 w-4" />
                Create estimate instead
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scheduling}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={scheduling || !scheduledDate}
            >
              {scheduling ? "Scheduling..." : "Schedule Estimate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LineItemsEstimateDialog
        open={lineItemsOpen}
        onOpenChange={setLineItemsOpen}
        lead={lead}
        onSuccess={handleLineItemsSuccess}
      />
    </>
  );
}
