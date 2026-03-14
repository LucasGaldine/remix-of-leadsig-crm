import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

export interface CrewHoursData {
  user_id: string;
  full_name: string;
  total_hours: number;
  job_count: number;
}

export function useCrewHours(startDate: Date, endDate: Date, userId?: string) {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["crew-hours", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), userId, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [];

      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const { data: schedules, error: schedulesError } = await supabase
        .from("job_schedules")
        .select("id, lead_id, scheduled_date")
        .gte("scheduled_date", startDateStr)
        .lte("scheduled_date", endDateStr);

      if (schedulesError) throw schedulesError;
      if (!schedules || schedules.length === 0) return [];

      const scheduleIds = schedules.map(s => s.id);

      let query = supabase
        .from("job_time_entries")
        .select(`
          *,
          job_schedule:job_schedules!job_schedule_id(
            scheduled_date,
            lead_id,
            job:leads!lead_id(
              account_id
            )
          ),
          user:profiles!user_id(
            id,
            full_name
          )
        `)
        .in("job_schedule_id", scheduleIds)
        .not("end_time", "is", null);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const hoursMap = new Map<string, CrewHoursData & { jobIds: Set<string> }>();

      (data || []).forEach((entry: any) => {
        if (entry.job_schedule?.job?.account_id !== currentAccount.id) return;

        const userId = entry.user_id;
        const fullName = entry.user?.full_name || "Unknown";
        const leadId = entry.job_schedule?.lead_id;

        const startTime = new Date(entry.start_time);
        const endTime = new Date(entry.end_time);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        if (hoursMap.has(userId)) {
          const existing = hoursMap.get(userId)!;
          existing.total_hours += hours;
          if (leadId) existing.jobIds.add(leadId);
        } else {
          const jobIds = new Set<string>();
          if (leadId) jobIds.add(leadId);
          hoursMap.set(userId, {
            user_id: userId,
            full_name: fullName,
            total_hours: hours,
            job_count: 0,
            jobIds,
          });
        }
      });

      return Array.from(hoursMap.values()).map(({ jobIds, ...rest }) => ({
        ...rest,
        job_count: jobIds.size,
      })).sort((a, b) => b.total_hours - a.total_hours);

    },
    enabled: !!currentAccount?.id,
  });
}
