import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

export function useScheduledJobs(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scheduled-jobs", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_schedules")
        .select(`
          *,
          job:leads!lead_id(
            *,
            customer:customers!customer_id(id, name, email, phone, address),
            crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
          )
        `)
        .eq("scheduled_date", date)
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data || []).map((schedule) => ({
        ...schedule.job,
        schedule_id: schedule.id,
        scheduled_date: schedule.scheduled_date,
        scheduled_time_start: schedule.scheduled_time_start,
        scheduled_time_end: schedule.scheduled_time_end,
      }));
    },
    enabled: !!user && !!date,
  });
}

export function useScheduledJobsForWeek(startDate: Date, endDate: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scheduled-jobs-week", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_schedules")
        .select("scheduled_date")
        .gte("scheduled_date", format(startDate, "yyyy-MM-dd"))
        .lte("scheduled_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      const jobDates = new Set<string>();
      data?.forEach((schedule) => {
        if (schedule.scheduled_date) {
          jobDates.add(schedule.scheduled_date);
        }
      });

      return jobDates;
    },
    enabled: !!user,
  });
}
