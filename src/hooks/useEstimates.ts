import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/types/database";
import { useAuth } from "./useAuth";
import { toDisplayStatus } from "@/lib/jobLifecycle";

type Estimate = Database["public"]["Tables"]["estimates"]["Row"];
type EstimateStatus = Database["public"]["Enums"]["estimate_status"];

export interface EstimateWithDetails extends Estimate {
  versions?: {
    id: string;
    name: string;
    subtotal: number;
    tax_rate: number;
    tax: number;
    discount: number;
    total: number;
    profit_margin?: number;
    surcharge?: number;
    notes?: string | null;
    line_items: Array<{
      name: string;
      description?: string | null;
      quantity: number;
      unit: string;
      unit_price: number;
      total: number;
      sort_order?: number;
      category?: "equipment" | "materials" | "labor" | "other";
    }>;
    created_at: string;
    updated_at: string;
  }[];
  customer: {
    id: string;
    name: string;
  } | null;
  job: {
    id: string;
    name: string;
    status: string;
    address?: string;
    scheduled_date?: string | null;
    scheduled_time_start?: string | null;
    scheduled_time_end?: string | null;
    last_scheduled_date?: string | null;
    display_status?: "unscheduled" | "scheduled" | "in_progress" | "completed";
    job_schedules?: Array<{
      scheduled_date?: string | null;
      scheduled_time_start?: string | null;
      scheduled_time_end?: string | null;
    }>;
    estimate_job_id?: string | null;
    is_estimate_visit?: boolean;
  } | null;
  recurring_job: {
    id: string;
    name: string;
    client_share_token: string | null;
  } | null;
  account: {
    company_name?: string;
    company_email?: string;
    company_phone?: string;
    logo_url?: string;
  } | null;
  line_items: {
    id: string;
    name: string;
    description?: string;
    category?: "equipment" | "materials" | "labor" | "other";
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
    sort_order?: number;
    is_change_order?: boolean;
    change_order_type?: 'added' | 'edited' | 'deleted';
    original_line_item_id?: string;
    changed_at?: string;
    change_order_approved?: boolean | null;
  }[];
  original_line_items?: {
    id: string;
    name: string;
    description?: string;
    category?: "equipment" | "materials" | "labor" | "other";
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
    sort_order?: number;
  }[] | null;
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
          recurring_job:recurring_jobs(id, name, client_share_token),
          line_items:estimate_line_items(
            id,
            name,
            description,
            category,
            quantity,
            unit,
            unit_price,
            total,
            sort_order,
            is_change_order,
            change_order_type,
            original_line_item_id,
            changed_at,
            change_order_approved
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
          job:leads!estimates_job_id_fkey(
            id,
            name,
            status,
            scheduled_date,
            address,
            service_type,
            job_schedules!lead_id(scheduled_date, scheduled_time_start, scheduled_time_end)
          ),
          recurring_job:recurring_jobs(id, name, client_share_token),
          account:accounts(company_name, company_email, company_phone, logo_url),
          line_items:estimate_line_items(
            id,
            name,
            description,
            category,
            quantity,
            unit,
            unit_price,
            total,
            sort_order,
            is_change_order,
            change_order_type,
            original_line_item_id,
            changed_at,
            change_order_approved
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      const estimate = data as EstimateWithDetails;
      if (estimate.job) {
        const schedules = ((estimate.job as any).job_schedules || []) as Array<{
          scheduled_date?: string | null;
          scheduled_time_start?: string | null;
          scheduled_time_end?: string | null;
        }>;
        const sortedSchedules = schedules
          .filter((schedule) => Boolean(schedule?.scheduled_date))
          .sort((a, b) => {
            const dateCompare = (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
            if (dateCompare !== 0) return dateCompare;
            if (!a.scheduled_time_start) return 1;
            if (!b.scheduled_time_start) return -1;
            return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
          });
        const earliestSchedule = sortedSchedules[0] || null;
        const latestSchedule = sortedSchedules[sortedSchedules.length - 1] || null;

        (estimate.job as any).scheduled_date =
          (estimate.job as any).scheduled_date || earliestSchedule?.scheduled_date || null;
        (estimate.job as any).scheduled_time_start =
          (estimate.job as any).scheduled_time_start || earliestSchedule?.scheduled_time_start || null;
        (estimate.job as any).scheduled_time_end =
          (estimate.job as any).scheduled_time_end || earliestSchedule?.scheduled_time_end || null;
        (estimate.job as any).last_scheduled_date = latestSchedule?.scheduled_date || null;
        (estimate.job as any).display_status = toDisplayStatus(
          estimate.job.status,
          sortedSchedules,
        );
      }

      if (estimate.original_total) {
        const { data: originalLineItems } = await supabase
          .from("estimate_line_items_original")
          .select("*")
          .eq("estimate_id", id)
          .order("sort_order");

        estimate.original_line_items = originalLineItems || null;
      }

      const { data: versions } = await supabase
        .from("estimate_versions")
        .select(`
          id,
          name,
          subtotal,
          tax_rate,
          tax,
          discount,
          total,
          profit_margin,
          surcharge,
          notes,
          line_items,
          created_at,
          updated_at
        `)
        .eq("estimate_id", id)
        .order("created_at", { ascending: true });

      estimate.versions = (versions || []) as EstimateWithDetails["versions"];

      return estimate;
    },
    enabled: !!user && !!id,
  });
}
