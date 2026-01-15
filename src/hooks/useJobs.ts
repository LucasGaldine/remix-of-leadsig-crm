import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Job = Database["public"]["Tables"]["jobs"]["Row"];
type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
type JobStatus = Database["public"]["Enums"]["job_status"];

export function useJobs(filter?: { status?: JobStatus; date?: string; limit?: number }) {
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
          table: "jobs",
        },
        (payload) => {
          console.log("Real-time job update:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
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
        .from("jobs")
        .select(`
          *,
          customer:customers(id, name, email, phone),
          crew_lead:profiles!jobs_crew_lead_id_fkey(id, full_name)
        `)
        .order("scheduled_date", { ascending: true });

      if (filter?.status) {
        query = query.eq("status", filter.status);
      }

      if (filter?.date) {
        query = query.eq("scheduled_date", filter.date);
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
          table: "jobs",
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
        .from("jobs")
        .select(`
          *,
          customer:customers(id, name, email, phone, address),
          crew_lead:profiles!jobs_crew_lead_id_fkey(id, full_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Job;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (job: Omit<JobInsert, "created_by">) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("jobs")
        .insert({ ...job, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: JobUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", data.id] });
    },
  });
}

export function useTodaysJobs() {
  const today = new Date().toISOString().split("T")[0];
  return useJobs({ date: today });
}
