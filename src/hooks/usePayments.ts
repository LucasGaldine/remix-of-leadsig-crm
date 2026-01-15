import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface PaymentWithDetails extends Payment {
  customer: {
    id: string;
    name: string;
  } | null;
  job: {
    id: string;
    name: string;
  } | null;
  invoice: {
    id: string;
    total: number;
  } | null;
}

export function usePayments(filter?: { status?: PaymentStatus; limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("payments-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["payments"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["payments", filter],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(`
          *,
          customer:customers(id, name),
          lead:leads(id, name),
          invoice:invoices(id, total)
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
      return data as PaymentWithDetails[];
    },
    enabled: !!user,
  });
}

export function usePayment(id: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`payment-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["payment", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, queryClient]);

  return useQuery({
    queryKey: ["payment", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          customer:customers(id, name, email, phone, address),
          lead:leads(id, name),
          invoice:invoices(id, total, balance_due)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as PaymentWithDetails;
    },
    enabled: !!user && !!id,
  });
}
