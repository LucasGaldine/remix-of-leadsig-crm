import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Notification {
  id: string;
  account_id: string;
  title: string;
  body: string;
  event_type: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!currentAccount,
    refetchInterval: 30000,
  });

  const unreadCount = (query.data || []).filter((n) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!currentAccount) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("account_id", currentAccount.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
