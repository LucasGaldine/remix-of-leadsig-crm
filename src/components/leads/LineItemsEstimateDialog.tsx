import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type EstimateLineItem } from "./EstimateLineItemsEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { normalizeVoiceEstimateParsedData } from "@/lib/voiceIntake";
import type { VoiceEstimateParsedData } from "@/types/voiceIntake";
import { createEstimateVersionSnapshot } from "@/lib/estimateVersions";
import { CreateJobEstimateStepContent } from "@/components/jobs/CreateJobEstimateStepContent";
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
  const [estimateName, setEstimateName] = useState("Version 1");
  const [profitMargin, setProfitMargin] = useState<string>(String(currentAccount?.default_profit_margin ?? 0));
  const [profitMode, setProfitMode] = useState<"percentage" | "amount">("percentage");
  const [profitAmount, setProfitAmount] = useState<string>("0");
  const [surcharge, setSurcharge] = useState<string>(String(currentAccount?.default_surcharge ?? 0));
  const [creating, setCreating] = useState(false);
  const [showVoiceEstimateIntake, setShowVoiceEstimateIntake] = useState(false);

  useEffect(() => {
    if (open) {
      setLineItems(defaultLineItems);
      setEstimateName("Version 1");
      const defaultProfitMargin = Number(currentAccount?.default_profit_margin ?? 0);
      const defaultSubtotal = defaultLineItems.reduce((sum, item) => {
        const quantity = Number.parseFloat(item.quantity || "0") || 0;
        const unitPrice = Number.parseFloat(item.unit_price || "0") || 0;
        return sum + (quantity * unitPrice);
      }, 0);
      setProfitMargin(String(defaultProfitMargin));
      setProfitMode("percentage");
      setProfitAmount((defaultSubtotal * (defaultProfitMargin / 100)).toFixed(2));
      setSurcharge(String(currentAccount?.default_surcharge ?? 0));
      setShowVoiceEstimateIntake(false);
    }
  }, [open, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

  useEffect(() => {
    if (!open || !currentAccount?.id) return;

    let isCancelled = false;

    const syncAccountDefaults = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("default_profit_margin, default_surcharge")
        .eq("id", currentAccount.id)
        .maybeSingle();

      if (isCancelled || error || !data) return;

      setProfitMargin(String(data.default_profit_margin ?? 0));
      setSurcharge(String(data.default_surcharge ?? 0));
    };

    void syncAccountDefaults();

    return () => {
      isCancelled = true;
    };
  }, [open, currentAccount?.id]);

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
          category: "other",
        };
      });

      setLineItems(parsedLineItems);
    }

    setShowVoiceEstimateIntake(false);
  };

  const activeLineItems = lineItems.filter((item) => item.name && item.unit_price);

  const estimateEditorDraft = useMemo(() => {
    const taxRate = (currentAccount?.default_tax_rate ?? 0) / 100;
    const normalizedLineItems = lineItems
      .map((item, index) => {
        const quantity = Number.parseFloat(item.quantity || "0") || 0;
        const unitPrice = Number.parseFloat(item.unit_price || "0") || 0;
        return {
          id: `draft-item-${index}`,
          name: item.name,
          description: item.description || "",
          quantity,
          unit: item.unit || "item",
          unit_price: unitPrice,
          total: Number((quantity * unitPrice).toFixed(2)),
          sort_order: index,
          category: item.category || "other",
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
        };
      })
      .filter((item) => item.name.trim().length > 0);

    const subtotal = normalizedLineItems.reduce((sum, item) => sum + item.total, 0);
    const parsedProfitAmount = Number.parseFloat(profitAmount || "0");
    const effectiveProfitAmount = profitMode === "amount"
      ? (Number.isFinite(parsedProfitAmount) ? parsedProfitAmount : 0)
      : subtotal * ((Number.parseFloat(profitMargin || "0") || 0) / 100);
    const effectiveProfitMarginPercent = subtotal > 0 ? (effectiveProfitAmount / subtotal) * 100 : 0;
    const surchargeValue = (Number.parseFloat(surcharge || "0") || 0) / 100;
    const adjustedSubtotal = subtotal + effectiveProfitAmount + (subtotal * surchargeValue);
    const tax = adjustedSubtotal * taxRate;
    const total = adjustedSubtotal + tax;

    return {
      account_id: currentAccount?.id,
      status: "draft",
      line_items: normalizedLineItems,
      tax_rate: taxRate,
      discount: 0,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      profit_margin: Number(effectiveProfitMarginPercent.toFixed(6)),
      surcharge: Number.parseFloat(surcharge || "0") || 0,
    };
  }, [currentAccount?.default_tax_rate, currentAccount?.id, lineItems, profitMargin, profitMode, profitAmount, surcharge]);

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

      const parsedProfitAmount = Number.parseFloat(profitAmount || "0");
      const resolvedProfitAmount = profitMode === "amount"
        ? (Number.isFinite(parsedProfitAmount) ? parsedProfitAmount : 0)
        : estimateSubtotal * ((parseFloat(profitMargin) || 0) / 100);
      const profitMarginPercent = estimateSubtotal > 0 ? (resolvedProfitAmount / estimateSubtotal) * 100 : 0;
      const surchargePercent = parseFloat(surcharge) || 0;
      const surchargeValue = surchargePercent / 100;
      const surchargeAmount = estimateSubtotal * surchargeValue;
      const subtotalAfterAdjustments = estimateSubtotal + resolvedProfitAmount + surchargeAmount;
      const taxRatePercent = currentAccount?.default_tax_rate ?? 0;
      const taxRate = taxRatePercent / 100;
      const taxAmount = subtotalAfterAdjustments * taxRate;
      const estimateTotal = subtotalAfterAdjustments + taxAmount;
      const normalizedEstimateName = estimateName.trim() || "Version 1";

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

        <div className="py-4">
          <CreateJobEstimateStepContent
            open={open}
            showVoiceEstimateIntake={showVoiceEstimateIntake}
            estimateEditorDraft={estimateEditorDraft}
            estimateVersionName={estimateName}
            onShowVoiceEstimateIntake={() => setShowVoiceEstimateIntake(true)}
            onHideVoiceEstimateIntake={() => setShowVoiceEstimateIntake(false)}
            onEstimateVersionNameChange={setEstimateName}
            onDraftChange={({
              lineItems: updatedLineItems,
              profitMargin: updatedProfitMargin,
              surcharge: updatedSurcharge,
              profitMode: updatedProfitMode,
              profitAmount: updatedProfitAmount,
            }) => {
              setLineItems(
                updatedLineItems.map((item) => ({
                  name: item.name,
                  description: item.description || "",
                  quantity: item.quantity || "1",
                  unit: item.unit || "item",
                  unit_price: item.unit_price || "0",
                  category: item.category || "other",
                })),
              );
              setProfitMargin(updatedProfitMargin);
              setProfitMode(updatedProfitMode || "percentage");
              setProfitAmount(updatedProfitAmount || "0");
              setSurcharge(updatedSurcharge);
            }}
            onApplyVoiceEstimateIntake={applyVoiceEstimateIntake}
          />
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
