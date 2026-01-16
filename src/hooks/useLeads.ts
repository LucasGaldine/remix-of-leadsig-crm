import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type LeadStatus = Database["public"]["Enums"]["unified_status"];

export function useLeads(filter?: LeadStatus | "all") {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    console.log("Setting up real-time subscription for leads");

    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          console.log("Real-time lead update:", payload.eventType, payload);
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
          
          // If it's an update to a specific lead, invalidate that too
          if (payload.eventType === "UPDATE" && payload.new) {
            queryClient.invalidateQueries({ queryKey: ["lead", (payload.new as Lead).id] });
          }
        }
      )
      .subscribe((status) => {
        console.log("Leads real-time subscription status:", status);
      });

    return () => {
      console.log("Cleaning up leads real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["leads", filter, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      let query = supabase
        .from("leads")
        .select("*")
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved") // Only show approved leads in main pipeline
        .order("created_at", { ascending: false });

      if (filter && filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useLead(id: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for single lead
  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`lead-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log("Real-time single lead update:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["lead", id] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, queryClient]);

  return useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Lead;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (lead: Omit<LeadInsert, "created_by" | "account_id">) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      const { data, error } = await supabase
        .from("leads")
        .insert({ ...lead, created_by: user.id, account_id: currentAccount.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", data.id] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    },
  });
}

export function useLeadCounts() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["lead-counts", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return {
        all: 0,
        new: 0,
        contacted: 0,
        qualified: 0,
        scheduled: 0,
        in_progress: 0,
        won: 0,
        lost: 0,
      };

      const { data, error } = await supabase
        .from("leads")
        .select("status")
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved"); // Only count approved leads

      if (error) throw error;

      const counts: Record<string, number> = {
        all: data.length,
        new: 0,
        contacted: 0,
        qualified: 0,
        scheduled: 0,
        in_progress: 0,
        won: 0,
        lost: 0,
      };

      data.forEach((lead) => {
        if (lead.status && counts[lead.status] !== undefined) {
          counts[lead.status]++;
        }
      });

      return counts;
    },
    enabled: !!user && !!currentAccount,
  });
}
