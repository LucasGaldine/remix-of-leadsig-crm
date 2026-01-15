import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Estimate = Database["public"]["Tables"]["estimates"]["Row"];
type EstimateStatus = Database["public"]["Enums"]["estimate_status"];

export interface EstimateWithDetails extends Estimate {
  customer: {
    id: string;
    name: string;
  } | null;
  job: {
    id: string;
    name: string;
  } | null;
  line_items: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
  }[];
}

export function useEstimates(filter?: { status?: EstimateStatus; limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("estimates-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "estimates",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["estimates"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["estimates", filter],
    queryFn: async () => {
      let query = supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name),
          lead:leads(id, name),
          line_items:estimate_line_items(
            id,
            name,
            quantity,
            unit,
            unit_price,
            total
          )
        `)
        .order("created_at", { ascending: false });

      if (filter?.status) {
        query = query.eq("status", filter.status);
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EstimateWithDetails[];
    },
    enabled: !!user,
  });
}

export function useEstimate(id: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`estimate-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "estimates",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["estimate", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, queryClient]);

  return useQuery({
    queryKey: ["estimate", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name, email, phone, address),
          lead:leads(id, name),
          line_items:estimate_line_items(
            id,
            name,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EstimateWithDetails;
    },
    enabled: !!user && !!id,
  });
}
