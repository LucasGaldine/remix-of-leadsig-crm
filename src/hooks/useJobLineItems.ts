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

  const { data: jobTaxInfo } = useQuery({
    queryKey: ["job-tax-info", jobId, currentAccount?.id],
    queryFn: async () => {
      if (!jobId || !currentAccount?.id) return null;

      const { data, error } = await supabase
        .from("leads")
        .select("tax_rate, tax, subtotal, total_with_tax")
        .eq("id", jobId)
        .eq("account_id", currentAccount.id)
        .maybeSingle();

      if (error) throw error;
      return data;
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

  const totalCost = lineItems?.reduce((sum, item) => sum + Number(item.total), 0) || 0;
  const taxRate = jobTaxInfo?.tax_rate ? Number(jobTaxInfo.tax_rate) : 0;
  const tax = jobTaxInfo?.tax ? Number(jobTaxInfo.tax) : 0;
  const subtotal = jobTaxInfo?.subtotal ? Number(jobTaxInfo.subtotal) : totalCost;
  const totalWithTax = jobTaxInfo?.total_with_tax ? Number(jobTaxInfo.total_with_tax) : totalCost;

  return {
    lineItems: lineItems || [],
    isLoading,
    totalCost,
    taxRate,
    tax,
    subtotal,
    totalWithTax,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  };
};
