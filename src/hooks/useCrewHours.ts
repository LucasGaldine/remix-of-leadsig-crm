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
        .gte("job_schedule.scheduled_date", format(startDate, "yyyy-MM-dd"))
        .lte("job_schedule.scheduled_date", format(endDate, "yyyy-MM-dd"))
        .not("end_time", "is", null);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const hoursMap = new Map<string, CrewHoursData>();

      (data || []).forEach((entry: any) => {
        if (entry.job_schedule?.job?.account_id !== currentAccount.id) return;

        const userId = entry.user_id;
        const fullName = entry.user?.full_name || "Unknown";

        const startTime = new Date(entry.start_time);
        const endTime = new Date(entry.end_time);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        if (hoursMap.has(userId)) {
          const existing = hoursMap.get(userId)!;
          existing.total_hours += hours;
          existing.job_count += 1;
        } else {
          hoursMap.set(userId, {
            user_id: userId,
            full_name: fullName,
            total_hours: hours,
            job_count: 1,
          });
        }
      });

      return Array.from(hoursMap.values()).sort((a, b) => b.total_hours - a.total_hours);
    },
    enabled: !!currentAccount?.id,
  });
}
