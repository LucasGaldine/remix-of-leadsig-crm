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
    status: string;
    address?: string;
    estimate_job_id?: string | null;
    is_estimate_visit?: boolean;
  } | null;
  account: {
    company_name?: string;
    company_email?: string;
    company_phone?: string;
  } | null;
  line_items: {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
    sort_order?: number;
    is_change_order?: boolean;
    change_order_type?: 'added' | 'edited' | 'deleted';
    original_line_item_id?: string;
    changed_at?: string;
  }[];
  estimate_visit_completed?: boolean;
}

export function useEstimates(filter?: { status?: EstimateStatus; limit?: number }) {
  const { user, currentAccount } = useAuth();
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
    queryKey: ["estimates", filter, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      let query = supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name),
          job:leads!estimates_job_id_fkey(id, name, status, scheduled_date, estimate_job_id, is_estimate_visit),
          line_items:estimate_line_items(
            id,
            name,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order,
            is_change_order,
            change_order_type,
            original_line_item_id,
            changed_at
          )
        `)
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false });

      if (filter?.status) {
        query = query.eq("status", filter.status);
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const estimates = data as EstimateWithDetails[];

      estimates.forEach(e => {
        if (e.job?.is_estimate_visit && e.job.status === 'completed') {
          e.estimate_visit_completed = true;
        }
      });

      return estimates;
    },
    enabled: !!user && !!currentAccount,
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
          job:leads!estimates_job_id_fkey(id, name, status, scheduled_date, address, service_type),
          account:accounts(company_name, company_email, company_phone),
          line_items:estimate_line_items(
            id,
            name,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order,
            is_change_order,
            change_order_type,
            original_line_item_id,
            changed_at
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
