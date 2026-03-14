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
        .select(`
          id,
          lead_id,
          scheduled_date,
          account_id
        `)
        .eq("account_id", currentAccount.id)
        .gte("scheduled_date", startDateStr)
        .lte("scheduled_date", endDateStr);

      if (schedulesError) throw schedulesError;
      if (!schedules || schedules.length === 0) return [];

      const scheduleIds = schedules.map(s => s.id);

      if (scheduleIds.length === 0) return [];

      let assignmentsQuery = supabase
        .from("job_assignments")
        .select(`
          user_id,
          job_schedule_id,
          lead_id,
          user:profiles!user_id(
            id,
            full_name
          )
        `)
        .in("job_schedule_id", scheduleIds)
        .not("job_schedule_id", "is", null);

      if (userId) {
        assignmentsQuery = assignmentsQuery.eq("user_id", userId);
      }

      const { data: assignments, error: assignmentsError } = await assignmentsQuery;
      if (assignmentsError) throw assignmentsError;

      let timeEntriesQuery = supabase
        .from("job_time_entries")
        .select(`
          user_id,
          lead_id,
          clock_in,
          clock_out
        `)
        .gte("clock_in", startDateStr)
        .lte("clock_in", `${endDateStr}T23:59:59`)
        .not("clock_out", "is", null);

      if (userId) {
        timeEntriesQuery = timeEntriesQuery.eq("user_id", userId);
      }

      const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery;
      if (timeEntriesError) throw timeEntriesError;

      const scheduleMap = new Map(schedules.map(s => [s.id, s.lead_id]));
      const crewMap = new Map<string, CrewHoursData & { jobIds: Set<string> }>();

      (assignments || []).forEach((assignment: any) => {
        const userId = assignment.user_id;
        const fullName = assignment.user?.full_name || "Unknown";
        const leadId = assignment.lead_id;

        if (!crewMap.has(userId)) {
          crewMap.set(userId, {
            user_id: userId,
            full_name: fullName,
            total_hours: 0,
            job_count: 0,
            jobIds: new Set(),
          });
        }

        if (leadId) {
          crewMap.get(userId)!.jobIds.add(leadId);
        }
      });

      (timeEntries || []).forEach((entry: any) => {
        const userId = entry.user_id;
        const clockIn = new Date(entry.clock_in);
        const clockOut = new Date(entry.clock_out);
        const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

        if (crewMap.has(userId)) {
          crewMap.get(userId)!.total_hours += hours;
        }
      });

      return Array.from(crewMap.values()).map(({ jobIds, ...rest }) => ({
        ...rest,
        job_count: jobIds.size,
      })).sort((a, b) => b.total_hours - a.total_hours);

    },
    enabled: !!currentAccount?.id,
  });
}
