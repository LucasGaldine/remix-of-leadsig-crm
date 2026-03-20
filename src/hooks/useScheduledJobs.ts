import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

export function useScheduledJobs(date: string, myJobsOnly: boolean = false, crewMemberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scheduled-jobs", date, myJobsOnly, crewMemberId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("job_schedules")
        .select(`
          *,
          job:leads!lead_id(
            *,
            customer:customers!customer_id(id, name, email, phone, address),
            crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name),
            job_assignments!lead_id(id, user_id, job_schedule_id)
          )
        `)
        .eq("scheduled_date", date)
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;

      let filteredData = data || [];

      const targetUserId = crewMemberId || (myJobsOnly ? user.id : null);

      if (targetUserId) {
        filteredData = filteredData.filter((schedule) => {
          const assignments = schedule.job?.job_assignments || [];
          return assignments.some((assignment: any) =>
            assignment.user_id === targetUserId &&
            (assignment.job_schedule_id === schedule.id || assignment.job_schedule_id === null)
          );
        });
      }

      return filteredData.map((schedule) => ({
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

export function useScheduledJobsForWeek(startDate: Date, endDate: Date, myJobsOnly: boolean = false, crewMemberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scheduled-jobs-week", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), myJobsOnly, crewMemberId, user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from("job_schedules")
        .select(`
          scheduled_date,
          id,
          job:leads!lead_id(
            job_assignments!lead_id(user_id, job_schedule_id)
          )
        `)
        .gte("scheduled_date", format(startDate, "yyyy-MM-dd"))
        .lte("scheduled_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      let filteredData = data || [];

      const targetUserId = crewMemberId || (myJobsOnly ? user.id : null);

      if (targetUserId) {
        filteredData = filteredData.filter((schedule) => {
          const assignments = schedule.job?.job_assignments || [];
          return assignments.some((assignment: any) =>
            assignment.user_id === targetUserId &&
            (assignment.job_schedule_id === schedule.id || assignment.job_schedule_id === null)
          );
        });
      }

      const jobDates = new Set<string>();
      filteredData.forEach((schedule) => {
        if (schedule.scheduled_date) {
          jobDates.add(schedule.scheduled_date);
        }
      });

      return jobDates;
    },
    enabled: !!user,
  });
}
