import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type UnifiedStatus = Database["public"]["Enums"]["unified_status"];

type Job = Lead;
type JobInsert = Omit<LeadInsert, "approval_status"> & { customer_id: string };
type JobUpdate = LeadUpdate;
type JobStatus = UnifiedStatus;

export function useJobs(filter?: { status?: JobStatus; date?: string; limit?: number; searchQuery?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          console.log("Real-time job update:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["job-counts"] });
          queryClient.invalidateQueries({ queryKey: ["job-revenue"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["jobs", filter],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .in("status", ["scheduled", "in_progress", "completed", "won", "cancelled"])
        .order("created_at", { ascending: false });

      if (filter?.status) {
        query = query.eq("status", filter.status);
      }

      if (filter?.date) {
        query = query.eq("scheduled_date", filter.date);
      }

      if (filter?.searchQuery && filter.searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${filter.searchQuery}%,address.ilike.%${filter.searchQuery}%,service_type.ilike.%${filter.searchQuery}%,description.ilike.%${filter.searchQuery}%`
        );
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!user,
  });
}

export function useJob(id: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`job-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["job", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, queryClient]);

  return useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Job | null;
    },
    enabled: !!user && !!id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (job: Omit<JobInsert, "created_by" | "approval_status">) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...job,
          created_by: user.id,
          approval_status: "approved",
          status: job.status || "scheduled"
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: JobUpdate & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["job", data.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useTodaysJobs() {
  const today = new Date().toISOString().split("T")[0];
  return useJobs({ date: today });
}

export function useJobCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["job-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("status")
        .in("status", ["scheduled", "in_progress", "completed", "won", "cancelled"]);

      if (error) throw error;

      const counts: Record<string, number> = {
        all: data.length,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        won: 0,
        cancelled: 0,
      };

      data.forEach((lead) => {
        if (lead.status && counts[lead.status] !== undefined) {
          counts[lead.status]++;
        }
      });

      return counts;
    },
    enabled: !!user,
  });
}

export function useJobRevenue() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["job-revenue"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("leads")
        .select("actual_value")
        .in("status", ["completed", "won"])
        .gte("updated_at", startOfMonth.toISOString());

      if (error) throw error;

      const total = data.reduce((sum, job) => {
        return sum + (Number(job.actual_value) || 0);
      }, 0);

      return total;
    },
    enabled: !!user,
  });
}
