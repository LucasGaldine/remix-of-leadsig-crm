import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type RejectionReason = "low_budget" | "outside_service_area" | "not_ready" | "spam" | "duplicate" | "other";

interface PendingLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  service_type: string | null;
  estimated_budget: number | null;
  city: string | null;
  address: string | null;
  source: string | null;
  created_at: string;
  submitted_at: string | null;
  approval_status: string;
}

export function usePendingLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription for pending leads
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("pending-leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          // Refresh pending leads on any change
          queryClient.invalidateQueries({ queryKey: ["pending-leads"] });
          queryClient.invalidateQueries({ queryKey: ["pending-leads-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["pending-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, email, service_type, estimated_budget, city, address, source, created_at, submitted_at, approval_status")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingLead[];
    },
    enabled: !!user,
  });
}

export function usePendingLeadsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-leads-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
}

export function useApproveLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (leadId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Update lead approval status
      const { data: lead, error: updateError } = await supabase
        .from("leads")
        .update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_user_id: user.id,
          status: "new", // Move to pipeline as "New"
        })
        .eq("id", leadId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log the approval as an interaction
      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          lead_id: leadId,
          type: "status_change",
          summary: "Approved lead",
          direction: "na",
          created_by: user.id,
        });

      if (interactionError) {
        console.error("Failed to log interaction:", interactionError);
      }

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    },
  });
}

export function useRejectLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: RejectionReason }) => {
      if (!user) throw new Error("Not authenticated");

      // Update lead approval status
      const { data: lead, error: updateError } = await supabase
        .from("leads")
        .update({
          approval_status: "rejected",
          approval_reason: reason,
          rejected_at: new Date().toISOString(),
          rejected_by_user_id: user.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log the rejection as an interaction
      const reasonLabels: Record<RejectionReason, string> = {
        low_budget: "Low Budget",
        outside_service_area: "Outside Service Area",
        not_ready: "Not Ready",
        spam: "Spam",
        duplicate: "Duplicate",
        other: "Other",
      };

      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          lead_id: id,
          type: "status_change",
          summary: `Rejected lead (${reasonLabels[reason]})`,
          direction: "na",
          created_by: user.id,
        });

      if (interactionError) {
        console.error("Failed to log interaction:", interactionError);
      }

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    },
  });
}
