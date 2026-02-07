import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function useQualifiedLeads() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-leads", "qualified", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved")
        .eq("status", "qualified")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useActiveJobs() {
  const { user, currentAccount } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dashboard-leads", "active-jobs", today, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name),
          job_schedules!lead_id(scheduled_date, scheduled_time_start, scheduled_time_end)
        `)
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved")
        .eq("status", "job");

      if (error) throw error;

      const jobsWithSchedulesToday = (data || []).filter((job: any) => {
        const schedules = job.job_schedules || [];
        return schedules.some((schedule: any) => schedule.scheduled_date === today);
      }).map((job: any) => {
        const schedules = job.job_schedules || [];
        const todaySchedule = schedules.find((s: any) => s.scheduled_date === today);
        return {
          ...job,
          scheduled_date: todaySchedule?.scheduled_date,
          scheduled_time_start: todaySchedule?.scheduled_time_start,
          scheduled_time_end: todaySchedule?.scheduled_time_end,
          job_schedules: undefined,
        };
      }).sort((a: any, b: any) => {
        if (!a.scheduled_time_start) return 1;
        if (!b.scheduled_time_start) return -1;
        return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
      });

      return jobsWithSchedulesToday;
    },
    enabled: !!user && !!currentAccount,
  });
}

export function usePendingApprovalEstimates() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-estimates", "pending", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name)
        `)
        .eq("account_id", currentAccount.id)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentAccount,
  });
}
