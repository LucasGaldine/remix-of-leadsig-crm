import { useMemo } from "react";
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

const EVENT_TO_ALERT: Record<string, string> = {
  new_lead: "new_leads",
  lead_status_change: "lead_updates",
  payment_received: "payments",
  schedule_change: "schedule_changes",
  estimate_approved: "payments",
};

export function useNotifications() {
  const { currentAccount, profile } = useAuth();
  const queryClient = useQueryClient();

  const alertPrefs = useMemo(() => {
    const prefs = profile?.notification_preferences as
      | { alerts?: Record<string, boolean> }
      | null
      | undefined;
    return prefs?.alerts || null;
  }, [profile?.notification_preferences]);

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

  const filtered = useMemo(() => {
    const all = query.data || [];
    if (!alertPrefs) return all;
    return all.filter((n) => {
      const alertKey = EVENT_TO_ALERT[n.event_type];
      if (!alertKey) return true;
      return alertPrefs[alertKey] !== false;
    });
  }, [query.data, alertPrefs]);

  const unreadCount = filtered.filter((n) => !n.is_read).length;

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

  const deleteAll = useMutation({
    mutationFn: async () => {
      if (!currentAccount) return;
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("account_id", currentAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: filtered,
    isLoading: query.isLoading,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteAll: deleteAll.mutate,
    isDeletingAll: deleteAll.isPending,
  };
}
