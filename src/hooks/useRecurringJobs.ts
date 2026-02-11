import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { addWeeks, addMonths, format, isAfter, parseISO } from "date-fns";

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";

export interface RecurringJob {
  id: string;
  account_id: string;
  customer_id: string;
  name: string;
  service_type: string | null;
  address: string | null;
  description: string | null;
  frequency: RecurrenceFrequency;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  start_date: string;
  end_date: string | null;
  default_crew_user_ids: string[];
  estimated_value: number;
  is_active: boolean;
  instances_ahead: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringJobInput {
  customer_id: string;
  name: string;
  service_type?: string | null;
  address?: string | null;
  description?: string | null;
  frequency: RecurrenceFrequency;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  start_date: string;
  end_date?: string | null;
  default_crew_user_ids?: string[];
  estimated_value?: number;
}

function getNextDate(currentDate: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(currentDate, 1);
    case "biweekly":
      return addWeeks(currentDate, 2);
    case "monthly":
      return addMonths(currentDate, 1);
  }
}

export function useRecurringJobs() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["recurring-jobs", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("recurring_jobs")
        .select("*")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RecurringJob[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useRecurringJob(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recurring-job", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("recurring_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as RecurringJob | null;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateRecurringJob() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRecurringJobInput) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      const { data: recurringJob, error: createError } = await supabase
        .from("recurring_jobs")
        .insert({
          account_id: currentAccount.id,
          customer_id: input.customer_id,
          name: input.name,
          service_type: input.service_type || null,
          address: input.address || null,
          description: input.description || null,
          frequency: input.frequency,
          scheduled_time_start: input.scheduled_time_start || null,
          scheduled_time_end: input.scheduled_time_end || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          default_crew_user_ids: input.default_crew_user_ids || [],
          estimated_value: input.estimated_value || 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      await generateInstances(recurringJob as RecurringJob, currentAccount.id, user.id);

      return recurringJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
    },
  });
}

export function useUpdateRecurringJobCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recurringJobId, crewUserIds }: { recurringJobId: string; crewUserIds: string[] }) => {
      const { error } = await supabase
        .from("recurring_jobs")
        .update({
          default_crew_user_ids: crewUserIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recurringJobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-job"] });
    },
  });
}

export function useGenerateNextInstances() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (recurringJobId: string) => {
      if (!user || !currentAccount) throw new Error("Not authenticated");

      const { data: recurringJob, error } = await supabase
        .from("recurring_jobs")
        .select("*")
        .eq("id", recurringJobId)
        .maybeSingle();

      if (error) throw error;
      if (!recurringJob || !recurringJob.is_active) return;

      await generateInstances(recurringJob as RecurringJob, currentAccount.id, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
    },
  });
}

async function generateInstances(recurringJob: RecurringJob, accountId: string, userId: string) {
  const { data: existingInstances } = await supabase
    .from("leads")
    .select("id, recurring_instance_number, status")
    .eq("recurring_job_id", recurringJob.id)
    .order("recurring_instance_number", { ascending: false });

  const unpaidInstances = (existingInstances || []).filter(
    (i: any) => i.status !== "paid"
  );

  const instancesNeeded = recurringJob.instances_ahead - unpaidInstances.length;
  if (instancesNeeded <= 0) return;

  const maxInstanceNumber = existingInstances && existingInstances.length > 0
    ? Math.max(...existingInstances.map((i: any) => i.recurring_instance_number || 0))
    : 0;

  let nextDate: Date;
  if (maxInstanceNumber === 0) {
    nextDate = parseISO(recurringJob.start_date);
  } else {
    const lastInstance = existingInstances?.find(
      (i: any) => i.recurring_instance_number === maxInstanceNumber
    );

    if (lastInstance) {
      const { data: lastSchedule } = await supabase
        .from("job_schedules")
        .select("scheduled_date")
        .eq("lead_id", lastInstance.id)
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastDate = lastSchedule?.scheduled_date
        ? parseISO(lastSchedule.scheduled_date)
        : parseISO(recurringJob.start_date);

      nextDate = getNextDate(lastDate, recurringJob.frequency as RecurrenceFrequency);
    } else {
      nextDate = parseISO(recurringJob.start_date);
    }
  }

  for (let i = 0; i < instancesNeeded; i++) {
    const instanceNumber = maxInstanceNumber + i + 1;

    if (recurringJob.end_date && isAfter(nextDate, parseISO(recurringJob.end_date))) {
      break;
    }

    const dateStr = format(nextDate, "yyyy-MM-dd");

    const { data: job, error: jobError } = await supabase
      .from("leads")
      .insert({
        name: recurringJob.name,
        customer_id: recurringJob.customer_id,
        service_type: recurringJob.service_type,
        address: recurringJob.address,
        description: recurringJob.description,
        estimated_value: recurringJob.estimated_value || null,
        status: "job",
        approval_status: "approved",
        created_by: userId,
        account_id: accountId,
        recurring_job_id: recurringJob.id,
        recurring_instance_number: instanceNumber,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating recurring instance:", jobError);
      continue;
    }

    const { error: schedError } = await supabase
      .from("job_schedules")
      .insert({
        lead_id: job.id,
        scheduled_date: dateStr,
        scheduled_time_start: recurringJob.scheduled_time_start || null,
        scheduled_time_end: recurringJob.scheduled_time_end || null,
        created_by: userId,
        account_id: accountId,
      });

    if (schedError) {
      console.error("Error creating schedule for recurring instance:", schedError);
    }

    if (recurringJob.default_crew_user_ids && recurringJob.default_crew_user_ids.length > 0) {
      const { data: schedule } = await supabase
        .from("job_schedules")
        .select("id")
        .eq("lead_id", job.id)
        .maybeSingle();

      if (schedule) {
        const assignments = recurringJob.default_crew_user_ids.map((crewUserId: string) => ({
          lead_id: job.id,
          user_id: crewUserId,
          job_schedule_id: schedule.id,
          account_id: accountId,
          assigned_by: userId,
        }));

        const { error: assignError } = await supabase
          .from("job_assignments")
          .insert(assignments);

        if (assignError) {
          console.error("Error assigning crew to recurring instance:", assignError);
        }
      }
    }

    nextDate = getNextDate(nextDate, recurringJob.frequency as RecurrenceFrequency);
  }
}

export function usePauseRecurringJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("recurring_jobs")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-job"] });
    },
  });
}
