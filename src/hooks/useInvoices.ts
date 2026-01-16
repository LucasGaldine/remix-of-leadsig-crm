import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export interface InvoiceWithDetails extends Invoice {
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

export function useInvoices(filter?: { status?: InvoiceStatus; limit?: number }) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("invoices-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["invoices", filter, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      let query = supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(id, name),
          job:leads!invoices_lead_id_fkey(id, name),
          line_items:invoice_line_items(
            id,
            name,
            quantity,
            unit,
            unit_price,
            total
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
      return data as InvoiceWithDetails[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useInvoice(id: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`invoice-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["invoice", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, queryClient]);

  return useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(id, name, email, phone, address),
          job:leads!invoices_lead_id_fkey(id, name),
          line_items:invoice_line_items(
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
      return data as InvoiceWithDetails;
    },
    enabled: !!user && !!id,
  });
}
