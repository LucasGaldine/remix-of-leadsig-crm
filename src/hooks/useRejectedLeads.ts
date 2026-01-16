import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface RejectedLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  service_type: string | null;
  estimated_value: number | null;
  city: string | null;
  address: string | null;
  source: string | null;
  created_at: string;
  rejected_at: string | null;
  approval_status: string;
  approval_reason: string | null;
}

export function useRejectedLeads() {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for rejected leads
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("rejected-leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          // Refresh rejected leads on any change
          queryClient.invalidateQueries({ queryKey: ["rejected-leads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["rejected-leads", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, email, service_type, estimated_value, city, address, source, created_at, rejected_at, approval_status, approval_reason")
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "rejected")
        .order("rejected_at", { ascending: false });

      if (error) throw error;
      return data as RejectedLead[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useRestoreLead() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (leadId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      // Restore lead to pending status
      const { data: lead, error: updateError } = await supabase
        .from("leads")
        .update({
          approval_status: "pending",
          approval_reason: null,
          rejected_at: null,
          rejected_by_user_id: null,
        })
        .eq("id", leadId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log the restore as an interaction
      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          lead_id: leadId,
          account_id: currentAccount.id,
          type: "status_change",
          summary: "Restored lead from rejected",
          direction: "na",
          created_by: user.id,
        });

      if (interactionError) {
        console.error("Failed to log interaction:", interactionError);
      }

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rejected-leads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
