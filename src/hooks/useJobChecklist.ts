import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ChecklistItem {
  id: string;
  job_id: string;
  account_id: string;
  label: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useJobChecklist(jobId: string | undefined) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["job-checklist", jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from("job_checklist_items")
        .select("*")
        .eq("job_id", jobId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as ChecklistItem[];
    },
    enabled: !!user && !!jobId,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("job_checklist_items")
        .update({ is_completed, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-checklist", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ label, sort_order }: { label: string; sort_order: number }) => {
      if (!jobId || !currentAccount?.id) throw new Error("Missing context");

      const { error } = await supabase
        .from("job_checklist_items")
        .insert({
          job_id: jobId,
          account_id: currentAccount.id,
          label,
          sort_order,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-checklist", jobId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from("job_checklist_items")
        .update({ label, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-checklist", jobId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_checklist_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-checklist", jobId] });
    },
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    toggleItem,
    addItem,
    updateItem,
    deleteItem,
  };
}
