import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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
  created_at: string;
}

export const useJobLineItems = (jobId: string | undefined) => {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();

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
    mutationFn: async () => {
      if (!jobId || !currentAccount?.id) throw new Error("No job or account selected");

      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", jobId)
        .eq("account_id", currentAccount.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (estimateError) throw estimateError;
      if (!estimate) throw new Error("No accepted estimate found for this job");

      const { data: estimateLineItems, error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id)
        .eq("is_change_order", false)
        .order("sort_order", { ascending: true });

      if (lineItemsError) throw lineItemsError;
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

  const totalCost = lineItems?.reduce((sum, item) => sum + Number(item.total), 0) || 0;

  return {
    lineItems: lineItems || [],
    isLoading,
    totalCost,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    resyncFromEstimate,
  };
};
