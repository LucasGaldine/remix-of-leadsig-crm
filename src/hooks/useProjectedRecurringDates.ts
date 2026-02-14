import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  type RecurringJob,
  type RecurrenceFrequency,
  getNextDate,
  getFirstDate,
} from "./useRecurringJobs";
import { format, parseISO, isAfter, isBefore, addMonths } from "date-fns";

export interface ProjectedDate {
  date: string;
  recurringJob: RecurringJob;
}

function computeProjectedDates(
  recurringJob: RecurringJob,
  existingDates: Set<string>,
  rangeStart: Date,
  rangeEnd: Date,
): ProjectedDate[] {
  const results: ProjectedDate[] = [];
  const freq = recurringJob.frequency as RecurrenceFrequency;
  const daysOfWeek = recurringJob.preferred_days_of_week || [];
  const dayOfMonth = recurringJob.preferred_day_of_month || null;
  const endDate = recurringJob.end_date ? parseISO(recurringJob.end_date) : null;

  let current = getFirstDate(parseISO(recurringJob.start_date), freq, daysOfWeek, dayOfMonth);

  const limit = 200;
  let iterations = 0;

  while (iterations < limit) {
    iterations++;

    if (endDate && isAfter(current, endDate)) break;
    if (isAfter(current, rangeEnd)) break;

    if (!isBefore(current, rangeStart)) {
      const dateStr = format(current, "yyyy-MM-dd");
      if (!existingDates.has(dateStr)) {
        results.push({ date: dateStr, recurringJob });
      }
    }

    current = getNextDate(current, freq, daysOfWeek, dayOfMonth);
  }

  return results;
}

export function useProjectedRecurringDates(rangeStart: Date, rangeEnd: Date) {
  const { user, currentAccount } = useAuth();
  const projectionEnd = addMonths(rangeEnd, 3);

  return useQuery({
    queryKey: [
      "projected-recurring-dates",
      currentAccount?.id,
      format(rangeStart, "yyyy-MM-dd"),
      format(rangeEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      if (!currentAccount) return { dates: new Set<string>(), byDate: new Map<string, ProjectedDate[]>() };

      const { data: recurringJobs, error: rjError } = await supabase
        .from("recurring_jobs")
        .select("*")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true);

      if (rjError) throw rjError;
      if (!recurringJobs || recurringJobs.length === 0) {
        return { dates: new Set<string>(), byDate: new Map<string, ProjectedDate[]>() };
      }

      const recurringJobIds = recurringJobs.map((rj) => rj.id);

      const { data: existingSchedules, error: schedError } = await supabase
        .from("job_schedules")
        .select("scheduled_date, lead_id, leads!lead_id(recurring_job_id)")
        .gte("scheduled_date", format(rangeStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(projectionEnd, "yyyy-MM-dd"));

      if (schedError) throw schedError;

      const existingDatesByRj = new Map<string, Set<string>>();
      (existingSchedules || []).forEach((s: any) => {
        const rjId = s.leads?.recurring_job_id;
        if (rjId) {
          if (!existingDatesByRj.has(rjId)) {
            existingDatesByRj.set(rjId, new Set());
          }
          existingDatesByRj.get(rjId)!.add(s.scheduled_date);
        }
      });

      const allProjected: ProjectedDate[] = [];
      for (const rj of recurringJobs) {
        const existing = existingDatesByRj.get(rj.id) || new Set<string>();
        const projected = computeProjectedDates(
          rj as RecurringJob,
          existing,
          rangeStart,
          projectionEnd,
        );
        allProjected.push(...projected);
      }

      const dates = new Set<string>();
      const byDate = new Map<string, ProjectedDate[]>();
      for (const p of allProjected) {
        dates.add(p.date);
        if (!byDate.has(p.date)) {
          byDate.set(p.date, []);
        }
        byDate.get(p.date)!.push(p);
      }

      return { dates, byDate };
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useCreateRecurringInstance() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async ({
      recurringJob,
      date,
    }: {
      recurringJob: RecurringJob;
      date: string;
    }) => {
      if (!user || !currentAccount) throw new Error("Not authenticated");

      const { data: existingInstances } = await supabase
        .from("leads")
        .select("recurring_instance_number")
        .eq("recurring_job_id", recurringJob.id)
        .order("recurring_instance_number", { ascending: false })
        .limit(1);

      const maxNum = existingInstances?.[0]?.recurring_instance_number || 0;
      const instanceNumber = maxNum + 1;

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
          created_by: user.id,
          account_id: currentAccount.id,
          recurring_job_id: recurringJob.id,
          recurring_instance_number: instanceNumber,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      const { data: schedule, error: schedError } = await supabase
        .from("job_schedules")
        .insert({
          lead_id: job.id,
          scheduled_date: date,
          scheduled_time_start: recurringJob.scheduled_time_start || null,
          scheduled_time_end: recurringJob.scheduled_time_end || null,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (schedError) throw schedError;

      if (recurringJob.default_crew_user_ids && recurringJob.default_crew_user_ids.length > 0) {
        const assignments = recurringJob.default_crew_user_ids.map((crewUserId: string) => ({
          lead_id: job.id,
          user_id: crewUserId,
          job_schedule_id: schedule.id,
          account_id: currentAccount.id,
          assigned_by: user.id,
        }));

        await supabase.from("job_assignments").insert(assignments);
      }

      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-counts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["projected-recurring-dates"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-jobs"] });
    },
  });
}
