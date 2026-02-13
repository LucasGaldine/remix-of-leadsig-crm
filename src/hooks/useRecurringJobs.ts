import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { addWeeks, addMonths, addDays, format, isAfter, parseISO, getDay, setDay, setDate, getDaysInMonth } from "date-fns";

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
  preferred_days_of_week: number[];
  preferred_day_of_month: number | null;
  client_share_token: string | null;
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
  preferred_days_of_week?: number[];
  preferred_day_of_month?: number | null;
}

function getNextDate(
  currentDate: Date,
  frequency: RecurrenceFrequency,
  preferredDaysOfWeek?: number[],
  preferredDayOfMonth?: number | null,
): Date {
  if (frequency === "monthly") {
    const next = addMonths(currentDate, 1);
    if (preferredDayOfMonth) {
      const maxDay = getDaysInMonth(next);
      const day = Math.min(preferredDayOfMonth, maxDay);
      return setDate(next, day);
    }
    return next;
  }

  if ((frequency === "weekly" || frequency === "biweekly") && preferredDaysOfWeek && preferredDaysOfWeek.length > 0) {
    const currentDay = getDay(currentDate);
    const sorted = [...preferredDaysOfWeek].sort((a, b) => a - b);
    const nextDayInWeek = sorted.find((d) => d > currentDay);

    if (nextDayInWeek !== undefined) {
      return setDay(currentDate, nextDayInWeek);
    }

    const weeksToAdd = frequency === "biweekly" ? 2 : 1;
    const nextWeek = addWeeks(currentDate, weeksToAdd);
    return setDay(nextWeek, sorted[0]);
  }

  switch (frequency) {
    case "weekly":
      return addWeeks(currentDate, 1);
    case "biweekly":
      return addWeeks(currentDate, 2);
    case "monthly":
      return addMonths(currentDate, 1);
  }
}

function getFirstDate(
  startDate: Date,
  frequency: RecurrenceFrequency,
  preferredDaysOfWeek?: number[],
  preferredDayOfMonth?: number | null,
): Date {
  if (frequency === "monthly" && preferredDayOfMonth) {
    const maxDay = getDaysInMonth(startDate);
    const day = Math.min(preferredDayOfMonth, maxDay);
    const adjusted = setDate(startDate, day);
    return isAfter(adjusted, startDate) || adjusted.getTime() === startDate.getTime()
      ? adjusted
      : setDate(addMonths(startDate, 1), Math.min(preferredDayOfMonth, getDaysInMonth(addMonths(startDate, 1))));
  }

  if ((frequency === "weekly" || frequency === "biweekly") && preferredDaysOfWeek && preferredDaysOfWeek.length > 0) {
    const currentDay = getDay(startDate);
    const sorted = [...preferredDaysOfWeek].sort((a, b) => a - b);
    const sameOrFuture = sorted.find((d) => d >= currentDay);
    if (sameOrFuture !== undefined) {
      return setDay(startDate, sameOrFuture);
    }
    return setDay(addWeeks(startDate, 1), sorted[0]);
  }

  return startDate;
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

      const shareToken = crypto.randomUUID();

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
          preferred_days_of_week: input.preferred_days_of_week || [],
          preferred_day_of_month: input.preferred_day_of_month || null,
          client_share_token: shareToken,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      await supabase
        .from("estimates")
        .insert({
          recurring_job_id: recurringJob.id,
          customer_id: input.customer_id,
          account_id: currentAccount.id,
          status: "draft",
          created_by: user.id,
        });

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

  const daysOfWeek = recurringJob.preferred_days_of_week || [];
  const dayOfMonth = recurringJob.preferred_day_of_month || null;

  let nextDate: Date;
  if (maxInstanceNumber === 0) {
    nextDate = getFirstDate(
      parseISO(recurringJob.start_date),
      recurringJob.frequency as RecurrenceFrequency,
      daysOfWeek,
      dayOfMonth,
    );
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

      nextDate = getNextDate(lastDate, recurringJob.frequency as RecurrenceFrequency, daysOfWeek, dayOfMonth);
    } else {
      nextDate = getFirstDate(
        parseISO(recurringJob.start_date),
        recurringJob.frequency as RecurrenceFrequency,
        daysOfWeek,
        dayOfMonth,
      );
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

    nextDate = getNextDate(nextDate, recurringJob.frequency as RecurrenceFrequency, daysOfWeek, dayOfMonth);
  }
}

export interface ConvertToRecurringInput {
  jobId: string;
  frequency: RecurrenceFrequency;
  start_date: string;
  end_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  preferred_days_of_week?: number[];
  preferred_day_of_month?: number | null;
  default_crew_user_ids?: string[];
}

export function useConvertToRecurring() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (input: ConvertToRecurringInput) => {
      if (!user || !currentAccount) throw new Error("Not authenticated");

      const { data: existingJob, error: fetchErr } = await supabase
        .from("leads")
        .select("*, customer:customers!leads_customer_id_fkey(*)")
        .eq("id", input.jobId)
        .maybeSingle();

      if (fetchErr || !existingJob) throw fetchErr || new Error("Job not found");

      const existingToken = existingJob.client_share_token;
      const shareToken = existingToken || crypto.randomUUID();

      const { data: recurringJob, error: createError } = await supabase
        .from("recurring_jobs")
        .insert({
          account_id: currentAccount.id,
          customer_id: existingJob.customer_id,
          name: existingJob.name || existingJob.customer?.name || "Recurring Job",
          service_type: existingJob.service_type || null,
          address: existingJob.address || null,
          description: existingJob.description || null,
          frequency: input.frequency,
          scheduled_time_start: input.scheduled_time_start || null,
          scheduled_time_end: input.scheduled_time_end || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          default_crew_user_ids: input.default_crew_user_ids || [],
          preferred_days_of_week: input.preferred_days_of_week || [],
          preferred_day_of_month: input.preferred_day_of_month || null,
          client_share_token: shareToken,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      if (existingToken) {
        await supabase
          .from("leads")
          .update({ client_share_token: null })
          .eq("id", input.jobId);
      }

      await supabase
        .from("leads")
        .update({
          recurring_job_id: recurringJob.id,
          recurring_instance_number: 1,
          status: "job",
        })
        .eq("id", input.jobId);

      const { data: existingSchedule } = await supabase
        .from("job_schedules")
        .select("id")
        .eq("lead_id", input.jobId)
        .maybeSingle();

      if (!existingSchedule) {
        const { data: newSchedule, error: schedError } = await supabase
          .from("job_schedules")
          .insert({
            lead_id: input.jobId,
            scheduled_date: input.start_date,
            scheduled_time_start: input.scheduled_time_start || null,
            scheduled_time_end: input.scheduled_time_end || null,
            created_by: user.id,
            account_id: currentAccount.id,
          })
          .select()
          .single();

        if (schedError) throw schedError;

        if (input.default_crew_user_ids && input.default_crew_user_ids.length > 0 && newSchedule) {
          const assignments = input.default_crew_user_ids.map((crewUserId: string) => ({
            lead_id: input.jobId,
            user_id: crewUserId,
            job_schedule_id: newSchedule.id,
            account_id: currentAccount.id,
            assigned_by: user.id,
          }));

          await supabase
            .from("job_assignments")
            .insert(assignments);
        }
      }

      const { data: existingEstimate } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", input.jobId)
        .maybeSingle();

      if (existingEstimate) {
        await supabase
          .from("estimates")
          .update({
            recurring_job_id: recurringJob.id,
            job_id: null,
          })
          .eq("id", existingEstimate.id);
      } else {
        await supabase
          .from("estimates")
          .insert({
            recurring_job_id: recurringJob.id,
            customer_id: existingJob.customer_id,
            account_id: currentAccount.id,
            status: "draft",
            created_by: user.id,
          });
      }

      await generateInstances(recurringJob as RecurringJob, currentAccount.id, user.id);

      return recurringJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-job"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["job-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["job-assignments"] });
    },
  });
}

export function useRecurringJobEstimate(recurringJobId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recurring-job-estimate", recurringJobId],
    queryFn: async () => {
      if (!recurringJobId) return null;

      const { data, error } = await supabase
        .from("estimates")
        .select("id, total, subtotal, tax, discount, status, line_items:estimate_line_items(id, name, quantity, unit_price, total)")
        .eq("recurring_job_id", recurringJobId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!recurringJobId,
  });
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
