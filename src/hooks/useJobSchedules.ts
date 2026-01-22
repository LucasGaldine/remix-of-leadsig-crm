import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobSchedule {
  id: string;
  lead_id: string;
  scheduled_date: string;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  notes?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export function useJobSchedules(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-schedules", jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from("job_schedules")
        .select("*")
        .eq("lead_id", jobId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as JobSchedule[];
    },
    enabled: !!jobId,
  });
}

export function useAddJobSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: {
      lead_id: string;
      scheduled_date: string;
      scheduled_time_start?: string;
      scheduled_time_end?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: accountMember } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!accountMember) throw new Error("No active account found");

      const { data: dayOffCheck, error: dayOffError } = await supabase
        .from("days_off")
        .select("date, reason")
        .eq("account_id", accountMember.account_id)
        .eq("date", schedule.scheduled_date)
        .maybeSingle();

      if (dayOffError) throw dayOffError;

      if (dayOffCheck) {
        const reason = dayOffCheck.reason ? ` (${dayOffCheck.reason})` : "";
        throw new Error(
          `Cannot schedule job on ${new Date(schedule.scheduled_date + "T00:00:00").toLocaleDateString()}${reason}. This date is marked as a day off.`
        );
      }

      const { data, error } = await supabase
        .from("job_schedules")
        .insert({
          ...schedule,
          created_by: user.id,
          account_id: accountMember.account_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-schedules", variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["job", variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
    },
  });
}

export function useUpdateJobSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobSchedule> & { id: string }) => {
      if (updates.scheduled_date) {
        const { data: existingSchedule } = await supabase
          .from("job_schedules")
          .select("account_id")
          .eq("id", id)
          .single();

        if (existingSchedule) {
          const { data: dayOffCheck, error: dayOffError } = await supabase
            .from("days_off")
            .select("date, reason")
            .eq("account_id", existingSchedule.account_id)
            .eq("date", updates.scheduled_date)
            .maybeSingle();

          if (dayOffError) throw dayOffError;

          if (dayOffCheck) {
            const reason = dayOffCheck.reason ? ` (${dayOffCheck.reason})` : "";
            throw new Error(
              `Cannot schedule job on ${new Date(updates.scheduled_date + "T00:00:00").toLocaleDateString()}${reason}. This date is marked as a day off.`
            );
          }
        }
      }

      const { data, error } = await supabase
        .from("job_schedules")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-schedules", data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["job", data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
    },
  });
}

export function useDeleteJobSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, lead_id }: { id: string; lead_id: string }) => {
      const { error } = await supabase
        .from("job_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, lead_id };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-schedules", variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["job", variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
    },
  });
}
