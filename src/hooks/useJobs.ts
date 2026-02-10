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
  const { user, currentAccount } = useAuth();
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
    queryKey: ["jobs", filter, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      let query = supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name),
          job_schedules!lead_id(scheduled_date, scheduled_time_start, scheduled_time_end),
          job_assignments!lead_id(id)
        `)
        .eq("account_id", currentAccount.id)
        .in("status", ["job", "paid", "completed"])
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

      return (data || []).map((job: any) => {
        const schedules = job.job_schedules || [];
        const sortedSchedules = schedules.length > 0
          ? schedules.sort((a: any, b: any) => {
              const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
              if (dateCompare !== 0) return dateCompare;
              if (!a.scheduled_time_start) return 1;
              if (!b.scheduled_time_start) return -1;
              return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
            })
          : [];

        const earliestSchedule = sortedSchedules[0] || null;
        const latestSchedule = sortedSchedules[sortedSchedules.length - 1] || null;
        const crewCount = (job as any).job_assignments?.length || 0;

        let displayStatus = 'unscheduled';
        if (job.status === 'job' && sortedSchedules.length > 0) {
          const now = new Date();
          const firstDateTime = new Date(`${earliestSchedule.scheduled_date}T${earliestSchedule.scheduled_time_start || '00:00:00'}`);
          const lastDateTime = new Date(`${latestSchedule.scheduled_date}T${latestSchedule.scheduled_time_end || '23:59:59'}`);

          if (now > lastDateTime) {
            displayStatus = 'completed';
          } else if (now >= firstDateTime && now <= lastDateTime) {
            displayStatus = 'in_progress';
          } else {
            displayStatus = 'scheduled';
          }
        } else if (job.status === 'paid') {
          displayStatus = 'paid';
        } else if (job.status === 'completed') {
          displayStatus = 'completed';
        }

        return {
          ...job,
          scheduled_date: earliestSchedule?.scheduled_date,
          scheduled_time_start: earliestSchedule?.scheduled_time_start,
          scheduled_time_end: earliestSchedule?.scheduled_time_end,
          last_scheduled_date: latestSchedule?.scheduled_date,
          display_status: displayStatus,
          crew_count: crewCount,
          job_schedules: undefined,
          job_assignments: undefined,
        };
      });
    },
    enabled: !!user && !!currentAccount,
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
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name),
          job_schedules!lead_id(scheduled_date, scheduled_time_start, scheduled_time_end)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const schedules = (data as any).job_schedules || [];
      const sortedSchedules = schedules.length > 0
        ? schedules.sort((a: any, b: any) => {
            const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
            if (dateCompare !== 0) return dateCompare;
            if (!a.scheduled_time_start) return 1;
            if (!b.scheduled_time_start) return -1;
            return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
          })
        : [];

      const earliestSchedule = sortedSchedules[0] || null;
      const latestSchedule = sortedSchedules[sortedSchedules.length - 1] || null;

      let displayStatus = 'unscheduled';
      if (data.status === 'job' && sortedSchedules.length > 0) {
        const now = new Date();
        const firstDateTime = new Date(`${earliestSchedule.scheduled_date}T${earliestSchedule.scheduled_time_start || '00:00:00'}`);
        const lastDateTime = new Date(`${latestSchedule.scheduled_date}T${latestSchedule.scheduled_time_end || '23:59:59'}`);

        if (now > lastDateTime) {
          displayStatus = 'completed';
        } else if (now >= firstDateTime && now <= lastDateTime) {
          displayStatus = 'in_progress';
        } else {
          displayStatus = 'scheduled';
        }
      } else if (data.status === 'paid') {
        displayStatus = 'paid';
      } else if (data.status === 'completed') {
        displayStatus = 'completed';
      }

      return {
        ...data,
        scheduled_date: earliestSchedule?.scheduled_date,
        scheduled_time_start: earliestSchedule?.scheduled_time_start,
        scheduled_time_end: earliestSchedule?.scheduled_time_end,
        display_status: displayStatus,
        job_schedules: undefined,
      } as Job;
    },
    enabled: !!user && !!id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (job: Omit<JobInsert, "created_by" | "approval_status" | "account_id">) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...job,
          created_by: user.id,
          account_id: currentAccount.id,
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

export function useDeleteJob() {
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
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["job-revenue"] });
    },
  });
}

export function useTodaysJobs() {
  const today = new Date().toISOString().split("T")[0];
  return useJobs({ date: today });
}

export function useJobCounts() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["job-counts", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return {
        all: 0,
        unscheduled: 0,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        paid: 0,
      };

      const { data, error } = await supabase
        .from("leads")
        .select(`
          status,
          job_schedules!lead_id(scheduled_date, scheduled_time_start, scheduled_time_end)
        `)
        .eq("account_id", currentAccount.id)
        .in("status", ["job", "paid", "completed"]);

      if (error) throw error;

      const counts: Record<string, number> = {
        all: data.length,
        unscheduled: 0,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        paid: 0,
      };

      data.forEach((lead: any) => {
        const schedules = lead.job_schedules || [];
        let displayStatus = 'unscheduled';

        if (lead.status === 'job' && schedules.length > 0) {
          const sortedSchedules = schedules.sort((a: any, b: any) => {
            const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
            if (dateCompare !== 0) return dateCompare;
            if (!a.scheduled_time_start) return 1;
            if (!b.scheduled_time_start) return -1;
            return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
          });

          const earliestSchedule = sortedSchedules[0];
          const latestSchedule = sortedSchedules[sortedSchedules.length - 1];
          const now = new Date();
          const firstDateTime = new Date(`${earliestSchedule.scheduled_date}T${earliestSchedule.scheduled_time_start || '00:00:00'}`);
          const lastDateTime = new Date(`${latestSchedule.scheduled_date}T${latestSchedule.scheduled_time_end || '23:59:59'}`);

          if (now > lastDateTime) {
            displayStatus = 'completed';
          } else if (now >= firstDateTime && now <= lastDateTime) {
            displayStatus = 'in_progress';
          } else {
            displayStatus = 'scheduled';
          }
        } else if (lead.status === 'paid') {
          displayStatus = 'paid';
        } else if (lead.status === 'completed') {
          displayStatus = 'completed';
        }

        if (counts[displayStatus] !== undefined) {
          counts[displayStatus]++;
        }
      });

      return counts;
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useJobRevenue() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["job-revenue", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return 0;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("leads")
        .select("actual_value")
        .eq("account_id", currentAccount.id)
        .eq("status", "paid")
        .gte("updated_at", startOfMonth.toISOString());

      if (error) throw error;

      const total = data.reduce((sum, job) => {
        return sum + (Number(job.actual_value) || 0);
      }, 0);

      return total;
    },
    enabled: !!user && !!currentAccount,
  });
}
