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
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .eq("scheduled_date", date)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useScheduledJobsForWeek(startDate: Date, endDate: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scheduled-jobs-week", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("scheduled_date")
        .in("status", ["scheduled", "in_progress"])
        .gte("scheduled_date", format(startDate, "yyyy-MM-dd"))
        .lte("scheduled_date", format(endDate, "yyyy-MM-dd"))
        .not("scheduled_date", "is", null);

      if (error) throw error;

      const jobDates = new Set<string>();
      data?.forEach((job) => {
        if (job.scheduled_date) {
          jobDates.add(job.scheduled_date);
        }
      });

      return jobDates;
    },
    enabled: !!user,
  });
}
