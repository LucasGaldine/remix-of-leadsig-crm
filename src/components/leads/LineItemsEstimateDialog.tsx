import { useState, useEffect } from "react";
import { Mic } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstimateLineItemsEditor, type EstimateLineItem } from "./EstimateLineItemsEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { LineItemCategory } from "@/hooks/useJobLineItems";
import { VoiceIntakePanel } from "@/components/voice/VoiceIntakePanel";
import { normalizeVoiceEstimateParsedData } from "@/lib/voiceIntake";
import type { VoiceEstimateParsedData } from "@/types/voiceIntake";
import { createEstimateVersionSnapshot } from "@/lib/estimateVersions";
export type EstimateLineItemInit = EstimateLineItem;

interface LineItemsEstimateDialogProps {
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
  initialLineItems?: EstimateLineItemInit[];
}

export function LineItemsEstimateDialog({ open, onOpenChange, lead, onSuccess, initialLineItems }: LineItemsEstimateDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const defaultLineItems: EstimateLineItemInit[] = initialLineItems ??
    (lead.estimated_value
      ? [{ name: lead.service_type || "Service", description: "", quantity: "1", unit: "item", unit_price: lead.estimated_value.toString(), category: "other" }]
      : [{ name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" }]);

  const [lineItems, setLineItems] = useState<EstimateLineItemInit[]>(defaultLineItems);
  const [estimateName, setEstimateName] = useState("original");
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<Set<number>>(new Set());
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [surcharge, setSurcharge] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [showVoiceEstimateIntake, setShowVoiceEstimateIntake] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [snapshots, setSnapshots] = useState<Record<number, EstimateLineItemInit>>({});

  useEffect(() => {
    if (open) {
      setLineItems(defaultLineItems);
      setEstimateName("original");
      setPendingDeleteIndices(new Set());
      setProfitMargin(String(currentAccount?.default_profit_margin ?? 0));
      setSurcharge(String(currentAccount?.default_surcharge ?? 0));
      setExpandedIndex(0);
      setSnapshots({});
      setShowVoiceEstimateIntake(false);
    }
  }, [open, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

  const applyVoiceEstimateIntake = (parsedData: VoiceEstimateParsedData) => {
    const parsed = normalizeVoiceEstimateParsedData(parsedData);

    if (parsed.lineItems && parsed.lineItems.length > 0) {
      const parsedLineItems = parsed.lineItems.map((lineItem) => {
        const quantity = lineItem.quantity && lineItem.quantity > 0 ? lineItem.quantity : 1;
        const unitPrice = lineItem.unitPrice && lineItem.unitPrice > 0 ? lineItem.unitPrice : 0;

        return {
          name: lineItem.name || "",
          description: lineItem.description || "",
          quantity: String(quantity),
          unit: lineItem.unit || "item",
          unit_price: unitPrice > 0 ? String(unitPrice) : "",
          category: "other" as LineItemCategory,
        };
      });

      setLineItems(parsedLineItems);
      setPendingDeleteIndices(new Set());
      setExpandedIndex(parsedLineItems.length > 0 ? 0 : null);
      setSnapshots({});
    }

    setShowVoiceEstimateIntake(false);
  };

  const addLineItem = () => {
    const newItems = [...lineItems, { name: "", description: "", quantity: "1", unit: "item", unit_price: "", category: "other" as LineItemCategory }];
    const newIndex = newItems.length - 1;
    setLineItems(newItems);
    setSnapshots(prev => ({ ...prev, [newIndex]: { ...newItems[newIndex] } }));
    setExpandedIndex(newIndex);
  };

  const expandLineItem = (index: number) => {
    setSnapshots(prev => ({ ...prev, [index]: { ...lineItems[index] } }));
    setExpandedIndex(index);
  };

  const revertLineItem = (index: number) => {
    const snapshot = snapshots[index];
    if (snapshot) {
      const updated = [...lineItems];
      updated[index] = { ...snapshot };
      setLineItems(updated);
    }
    setExpandedIndex(null);
  };

  const markForDelete = (index: number) => {
    setPendingDeleteIndices(prev => new Set(prev).add(index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const undoDelete = (index: number) => {
    setPendingDeleteIndices(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const updateLineItem = (index: number, field: keyof EstimateLineItemInit, value: string) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const activeLineItems = lineItems.filter((_, i) => !pendingDeleteIndices.has(i));

  const isMissingEstimateNameColumnError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const maybeError = error as { message?: string | null; details?: string | null };
    const combinedMessage = `${maybeError.message ?? ""} ${maybeError.details ?? ""}`.toLowerCase();
    return (
      combinedMessage.includes("estimates") &&
      combinedMessage.includes("name") &&
      combinedMessage.includes("column")
    );
  };

  const handleCreate = async () => {
    if (!user || !currentAccount) {
      toast.error("Authentication required");
      return;
    }

    const validLineItems = activeLineItems.filter(item => item.name && item.unit_price);
    if (validLineItems.length === 0) {
      toast.error("At least one line item is required");
      return;
    }

    setCreating(true);
    const loadingToast = toast.loading("Creating estimate...");

    try {
      const { id: customerId } = await findOrCreateCustomer({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address || lead.city,
        city: lead.city,
        created_by: user.id,
        account_id: currentAccount.id,
      });


      const estimateSubtotal = validLineItems.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || "1");
        const unitPrice = parseFloat(item.unit_price);
        return sum + (quantity * unitPrice);
      }, 0);

      const profitMarginPercent = parseFloat(profitMargin) || 0;
      const profitMarginValue = profitMarginPercent / 100;
      const profitAmount = estimateSubtotal * profitMarginValue;
      const surchargePercent = parseFloat(surcharge) || 0;
      const surchargeValue = surchargePercent / 100;
      const surchargeAmount = estimateSubtotal * surchargeValue;
      const subtotalAfterAdjustments = estimateSubtotal + profitAmount + surchargeAmount;
      const taxRatePercent = currentAccount?.default_tax_rate ?? 0;
      const taxRate = taxRatePercent / 100;
      const taxAmount = subtotalAfterAdjustments * taxRate;
      const estimateTotal = subtotalAfterAdjustments + taxAmount;
      const normalizedEstimateName = estimateName.trim() || "original";

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          customer_id: customerId,
          estimated_value: estimateTotal,
        })
        .eq("id", lead.id);

      if (updateError) throw new Error("Failed to attach customer to lead");

      const estimateInsertBase = {
        customer_id: customerId,
        job_id: lead.id,
        subtotal: estimateSubtotal,
        profit_margin: profitMarginPercent,
        surcharge: surchargePercent,
        tax_rate: taxRate,
        tax: taxAmount,
        discount: 0,
        total: estimateTotal,
        status: "draft",
        created_by: user.id,
        account_id: currentAccount.id,
      };

      let { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          ...estimateInsertBase,
          name: normalizedEstimateName,
        })
        .select()
        .single();

      if (estimateError && isMissingEstimateNameColumnError(estimateError)) {
        ({ data: estimateData, error: estimateError } = await supabase
          .from("estimates")
          .insert(estimateInsertBase)
          .select()
          .single());
      }

      if (estimateError) throw new Error("Failed to create estimate");

      const lineItemsToInsert = validLineItems.map((item, index) => {
        const quantity = parseFloat(item.quantity || "1");
        const unitPrice = parseFloat(item.unit_price);
        const total = quantity * unitPrice;

        return {
          estimate_id: estimateData.id,
          account_id: currentAccount.id,
          name: item.name,
          description: item.description || null,
          quantity,
          unit: item.unit,
          unit_price: unitPrice,
          total,
          sort_order: index,
          category: item.category,
        };
      });

      const { error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw new Error("Failed to create line items");

      await createEstimateVersionSnapshot({
        estimateId: estimateData.id,
        accountId: currentAccount.id,
        name: normalizedEstimateName,
        subtotal: estimateSubtotal,
        taxRate: taxRate,
        tax: taxAmount,
        discount: 0,
        total: estimateTotal,
        profitMargin: profitMarginPercent,
        surcharge: surchargePercent,
        notes: null,
        lineItems: lineItemsToInsert.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: item.sort_order,
          category: item.category,
        })),
      });

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "note",
        direction: "na",
        summary: "Estimate created",
        body: `Estimate created with ${validLineItems.length} line items totaling $${estimateTotal.toFixed(2)}`,
        created_by: user.id,
      });

      toast.dismiss(loadingToast);
      toast.success("Estimate created! Send it to the customer for approval.");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });

      onSuccess();
      onOpenChange(false);
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Estimate</DialogTitle>
          <DialogDescription>
            Add line items for this estimate. The total will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="estimate-name">Estimate Name (optional)</Label>
            <Input
              id="estimate-name"
              value={estimateName}
              onChange={(event) => setEstimateName(event.target.value)}
              placeholder="original"
            />
          </div>

          {!showVoiceEstimateIntake ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowVoiceEstimateIntake(true)}
              >
                <Mic className="h-4 w-4 mr-2" />
                Voice Estimate Intake
              </Button>

              <EstimateLineItemsEditor
                leadId={lead.id}
                lineItems={lineItems}
                pendingDeleteIndices={pendingDeleteIndices}
                expandedIndex={expandedIndex}
                profitMargin={profitMargin}
                surcharge={surcharge}
                defaultTaxRate={currentAccount?.default_tax_rate ?? 0}
                onExpandLineItem={expandLineItem}
                onCollapseExpandedLineItem={() => setExpandedIndex(null)}
                onRevertLineItem={revertLineItem}
                onMarkForDelete={markForDelete}
                onUndoDelete={undoDelete}
                onUpdateLineItem={updateLineItem}
                onAddLineItem={addLineItem}
                onProfitMarginChange={setProfitMargin}
                onSurchargeChange={setSurcharge}
              />
            </>
          ) : (
            <div className="space-y-3">
              <VoiceIntakePanel
                entityType="estimate"
                title="Voice Estimate Intake"
                description="Dictate estimate details. Required fields will trigger follow-up questions before values are applied."
                transcriptPlaceholder="Example: Estimate for roof wash, add line items roof wash 1 each 900 and gutter flush 1 each 250..."
                variant="plain"
                onApply={(parsed) => applyVoiceEstimateIntake(parsed as VoiceEstimateParsedData)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowVoiceEstimateIntake(false)}
              >
                Back to Manual Form
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || showVoiceEstimateIntake || !activeLineItems.some(item => item.name && item.unit_price)}
          >
            {creating ? "Creating..." : "Create Estimate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
