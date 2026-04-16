import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type LineItemCategory = 'equipment' | 'materials' | 'labor' | 'other';
export type EstimateUpdateMode = "add_to" | "replace";
export type EstimateUpdateTarget = LineItemCategory | "entire_estimate";
export type EstimateSyncSource = "current" | "original";

export interface JobLineItem {
  id: string;
  lead_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order: number;
  account_id: string;
  estimate_line_item_id: string | null;
  category: LineItemCategory;
  created_at: string;
}

export const useJobLineItems = (jobId: string | undefined) => {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const fetchCurrentAcceptedEstimate = async () => {
    if (!jobId || !currentAccount?.id) throw new Error("No job or account selected");

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, tax_rate, discount, profit_margin, surcharge")
      .eq("job_id", jobId)
      .eq("account_id", currentAccount.id)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (estimateError) throw estimateError;
    if (!estimate) throw new Error("No accepted estimate found for this job");

    return estimate;
  };

  const { data: lineItems, isLoading } = useQuery({
    queryKey: ["job-line-items", jobId, currentAccount?.id],
    queryFn: async () => {
      if (!jobId || !currentAccount?.id) return [];

      const { data, error } = await supabase
        .from("job_line_items")
        .select("*")
        .eq("lead_id", jobId)
        .eq("account_id", currentAccount.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as JobLineItem[];
    },
    enabled: !!jobId && !!currentAccount?.id,
  });

  const { data: hasApprovedEstimate = false } = useQuery({
    queryKey: ["job-costs-approved-estimate", jobId, currentAccount?.id],
    queryFn: async () => {
      if (!jobId || !currentAccount?.id) return false;

      const { data, error } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", jobId)
        .eq("account_id", currentAccount.id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!jobId && !!currentAccount?.id,
  });

  const addLineItem = useMutation({
    mutationFn: async (item: Omit<JobLineItem, "id" | "created_at" | "account_id">) => {
      if (!currentAccount?.id) throw new Error("No account selected");

      const { data, error } = await supabase
        .from("job_line_items")
        .insert({
          ...item,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-line-items", jobId] });
      toast.success("Line item added");
    },
    onError: (error) => {
      console.error("Error adding line item:", error);
      toast.error("Failed to add line item");
    },
  });

  const updateLineItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobLineItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("job_line_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-line-items", jobId] });
      toast.success("Line item updated");
    },
    onError: (error) => {
      console.error("Error updating line item:", error);
      toast.error("Failed to update line item");
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_line_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-line-items", jobId] });
      toast.success("Line item deleted");
    },
    onError: (error) => {
      console.error("Error deleting line item:", error);
      toast.error("Failed to delete line item");
    },
  });

  const resyncFromEstimate = useMutation({
    mutationFn: async (source: EstimateSyncSource = "current") => {
      if (!jobId || !currentAccount?.id) throw new Error("No job or account selected");

      const estimate = await fetchCurrentAcceptedEstimate();

      let estimateLineItems: Array<{
        id: string;
        name: string;
        description: string | null;
        quantity: number;
        unit: string;
        unit_price: number;
        total: number;
        sort_order: number;
        category: LineItemCategory;
      }> = [];

      if (source === "original") {
        const { data: originalLineItems, error: originalLineItemsError } = await supabase
          .from("estimate_line_items_original")
          .select("original_line_item_id, name, description, quantity, unit, unit_price, total, sort_order")
          .eq("estimate_id", estimate.id)
          .eq("account_id", currentAccount.id)
          .order("sort_order", { ascending: true });

        if (originalLineItemsError) throw originalLineItemsError;

        const { data: estimateLineItemCategories, error: estimateLineItemCategoriesError } = await supabase
          .from("estimate_line_items")
          .select("id, category")
          .eq("estimate_id", estimate.id)
          .eq("account_id", currentAccount.id);

        if (estimateLineItemCategoriesError) throw estimateLineItemCategoriesError;

        const categoryByLineItemId = new Map(
          (estimateLineItemCategories ?? []).map((item) => [item.id, (item.category as LineItemCategory) || "other"]),
        );

        estimateLineItems = (originalLineItems ?? []).map((item) => ({
          id: item.original_line_item_id,
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          sort_order: item.sort_order || 0,
          category: categoryByLineItemId.get(item.original_line_item_id) || "other",
        }));
      } else {
        const { data: currentLineItems, error: currentLineItemsError } = await supabase
          .from("estimate_line_items")
          .select("id, name, description, quantity, unit, unit_price, total, sort_order, category")
          .eq("estimate_id", estimate.id)
          .eq("account_id", currentAccount.id)
          .or("is_change_order.is.null,and(is_change_order.eq.false),and(is_change_order.eq.true,change_order_type.neq.deleted)")
          .order("sort_order", { ascending: true });

        if (currentLineItemsError) throw currentLineItemsError;

        estimateLineItems = (currentLineItems ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          sort_order: item.sort_order || 0,
          category: (item.category as LineItemCategory) || "other",
        }));
      }

      if (!estimateLineItems || estimateLineItems.length === 0) {
        throw new Error("No line items found in estimate");
      }

      const { error: deleteError } = await supabase
        .from("job_line_items")
        .delete()
        .eq("lead_id", jobId)
        .eq("account_id", currentAccount.id);

      if (deleteError) throw deleteError;

      const newLineItems = estimateLineItems.map((item) => ({
        lead_id: jobId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total: item.total,
        sort_order: item.sort_order,
        account_id: currentAccount.id,
        estimate_line_item_id: item.id,
        category: item.category || 'other',
      }));

      const { error: insertError } = await supabase
        .from("job_line_items")
        .insert(newLineItems);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-line-items", jobId] });
      toast.success("Job costs synced from estimate");
    },
    onError: (error) => {
      console.error("Error syncing from estimate:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync from estimate");
    },
  });

  const updateEstimateFromJobCosts = useMutation({
    mutationFn: async ({
      mode,
      target,
    }: {
      mode: EstimateUpdateMode;
      target: EstimateUpdateTarget;
    }) => {
      if (!jobId || !currentAccount?.id) throw new Error("No job or account selected");
      const estimate = await fetchCurrentAcceptedEstimate();

      const { data: jobCostItems, error: jobCostItemsError } = await supabase
        .from("job_line_items")
        .select("name, description, quantity, unit, unit_price, total, category")
        .eq("lead_id", jobId)
        .eq("account_id", currentAccount.id)
        .order("sort_order", { ascending: true });

      if (jobCostItemsError) throw jobCostItemsError;

      const selectedJobItems =
        target === "entire_estimate"
          ? jobCostItems ?? []
          : (jobCostItems ?? []).filter((item) => item.category === target);

      if (mode === "replace") {
        const existingBaseItemsQuery = supabase
          .from("estimate_line_items")
          .select("id")
          .eq("estimate_id", estimate.id)
          .eq("account_id", currentAccount.id)
          .eq("is_change_order", false);

        if (target !== "entire_estimate") {
          existingBaseItemsQuery.eq("category", target);
        }

        const { data: existingBaseItems, error: existingBaseItemsError } = await existingBaseItemsQuery;
        if (existingBaseItemsError) throw existingBaseItemsError;

        const existingBaseItemIds = (existingBaseItems ?? []).map((item) => item.id);

        if (existingBaseItemIds.length > 0) {
          const { error: markDeletedError } = await supabase
            .from("estimate_line_items")
            .update({
              is_change_order: true,
              change_order_type: "deleted",
              change_order_approved: false,
              changed_at: new Date().toISOString(),
            })
            .in("id", existingBaseItemIds);

          if (markDeletedError) throw markDeletedError;
        }
      }

      if (mode === "add_to" && selectedJobItems.length === 0) {
        throw new Error("No matching job cost line items found to update the estimate");
      }

      if (selectedJobItems.length > 0) {
        const { data: existingEstimateItems, error: existingEstimateItemsError } = await supabase
          .from("estimate_line_items")
          .select("sort_order")
          .eq("estimate_id", estimate.id)
          .eq("account_id", currentAccount.id)
          .order("sort_order", { ascending: false })
          .limit(1);

        if (existingEstimateItemsError) throw existingEstimateItemsError;
        const maxSortOrder = existingEstimateItems?.[0]?.sort_order ?? 0;

        const lineItemsToInsert = selectedJobItems.map((item, index) => ({
          estimate_id: estimate.id,
          account_id: currentAccount.id,
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          sort_order: maxSortOrder + index + 1,
          category: item.category || "other",
          is_change_order: true,
          change_order_type: "added",
          change_order_approved: false,
          changed_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
          .from("estimate_line_items")
          .insert(lineItemsToInsert);

        if (insertError) throw insertError;
      }

      const { data: estimateTotalsItems, error: estimateTotalsItemsError } = await supabase
        .from("estimate_line_items")
        .select("id,total,quantity,category,unit_price")
        .eq("estimate_id", estimate.id)
        .eq("account_id", currentAccount.id)
        .or("is_change_order.is.null,and(is_change_order.eq.false),and(is_change_order.eq.true,change_order_type.neq.deleted)");

      if (estimateTotalsItemsError) throw estimateTotalsItemsError;

      const subtotal = (estimateTotalsItems ?? []).reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );
      const profitMarginRate = Number((estimate as any).profit_margin || 0) / 100;
      const surchargeRate = Number((estimate as any).surcharge || 0) / 100;
      const taxRate = Number(estimate.tax_rate || 0);
      const discount = Number(estimate.discount || 0);
      const laborItems = (estimateTotalsItems ?? []).filter((item) => item.category === "labor");

      // Fold profit dollars directly into labor line items to keep line-item totals aligned with estimate subtotal.
      let distributedProfitAmount = 0;
      if (profitMarginRate > 0 && laborItems.length > 0) {
        const totalProfitCents = Math.round(subtotal * profitMarginRate * 100);
        const baseShareCents = Math.floor(totalProfitCents / laborItems.length);
        const remainderCents = totalProfitCents - baseShareCents * laborItems.length;

        for (let index = 0; index < laborItems.length; index += 1) {
          const laborItem = laborItems[index];
          const shareCents = baseShareCents + (index < remainderCents ? 1 : 0);
          const shareAmount = shareCents / 100;
          const currentTotal = Number(laborItem.total || 0);
          const quantity = Number(laborItem.quantity || 0);
          const nextTotal = Number((currentTotal + shareAmount).toFixed(2));
          const nextUnitPrice = quantity > 0
            ? Number((nextTotal / quantity).toFixed(2))
            : Number((Number(laborItem.unit_price || 0) + shareAmount).toFixed(2));

          const { error: laborUpdateError } = await supabase
            .from("estimate_line_items")
            .update({
              unit_price: nextUnitPrice,
              total: nextTotal,
            })
            .eq("id", laborItem.id);

          if (laborUpdateError) throw laborUpdateError;
          distributedProfitAmount += shareAmount;
        }
      }

      const adjustedSubtotalValue = Number((subtotal + distributedProfitAmount).toFixed(2));
      const surchargeAmount = subtotal * surchargeRate;
      const adjustedSubtotal = adjustedSubtotalValue + surchargeAmount;
      const tax = adjustedSubtotal * taxRate;
      const total = adjustedSubtotal + tax - discount;

      const { error: updateEstimateError } = await supabase
        .from("estimates")
        .update({
          subtotal: adjustedSubtotalValue,
          tax,
          total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", estimate.id)
        .eq("account_id", currentAccount.id);

      if (updateEstimateError) throw updateEstimateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-line-items", jobId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });

      const targetLabel = variables.target === "entire_estimate" ? "entire estimate" : variables.target;
      const modeLabel = variables.mode === "replace" ? "replaced" : "added";
      toast.success(`Estimate updated: ${modeLabel} ${targetLabel}`);
    },
    onError: (error) => {
      console.error("Error updating estimate from job costs:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update estimate");
    },
  });

  const totalCost = lineItems?.reduce((sum, item) => sum + Number(item.total), 0) || 0;

  return {
    lineItems: lineItems || [],
    isLoading,
    totalCost,
    hasApprovedEstimate,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    resyncFromEstimate,
    updateEstimateFromJobCosts,
  };
};
