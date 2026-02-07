import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useDashboardStats(cardIds: string[]) {
  const { user, currentAccount } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["dashboard-stats", cardIds, currentAccount?.id, today],
    queryFn: async () => {
      if (!currentAccount) return {} as Record<string, number>;

      const stats: Record<string, number> = {};
      const needed = new Set(cardIds);

      if (needed.has("leads_pending")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("approval_status", "pending");
        stats.leads_pending = count || 0;
      }

      if (needed.has("pending_approvals")) {
        const { count } = await supabase
          .from("estimates")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("status", "sent");
        stats.pending_approvals = count || 0;
      }

      if (needed.has("qualified_leads")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("approval_status", "approved")
          .eq("status", "qualified");
        stats.qualified_leads = count || 0;
      }

      if (needed.has("active_jobs")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("status", "job");
        stats.active_jobs = count || 0;
      }

      if (needed.has("todays_jobs")) {
        const { data } = await supabase
          .from("job_schedules")
          .select("lead_id")
          .eq("scheduled_date", today);
        const uniqueJobs = new Set(data?.map((d) => d.lead_id));
        stats.todays_jobs = uniqueJobs.size;
      }

      if (needed.has("revenue_this_month")) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data } = await supabase
          .from("leads")
          .select("actual_value")
          .eq("account_id", currentAccount.id)
          .eq("status", "paid")
          .gte("updated_at", startOfMonth.toISOString());

        stats.revenue_this_month = (data || []).reduce(
          (sum, j) => sum + (Number(j.actual_value) || 0),
          0
        );
      }

      if (needed.has("outstanding_invoices")) {
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .in("status", ["sent", "overdue"]);
        stats.outstanding_invoices = count || 0;
      }

      if (needed.has("total_leads")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("approval_status", "approved")
          .in("status", ["new", "contacted", "qualified"]);
        stats.total_leads = count || 0;
      }

      if (needed.has("completed_jobs")) {
        const { data } = await supabase
          .from("leads")
          .select("id, job_schedules!lead_id(scheduled_date, scheduled_time_end)")
          .eq("account_id", currentAccount.id)
          .eq("status", "job");

        let completedCount = 0;
        const now = new Date();
        (data || []).forEach((job: any) => {
          const schedules = job.job_schedules || [];
          if (schedules.length === 0) return;
          const sorted = schedules.sort((a: any, b: any) =>
            a.scheduled_date.localeCompare(b.scheduled_date)
          );
          const last = sorted[sorted.length - 1];
          const endDt = new Date(
            `${last.scheduled_date}T${last.scheduled_time_end || "23:59:59"}`
          );
          if (now > endDt) completedCount++;
        });
        stats.completed_jobs = completedCount;
      }

      if (needed.has("paid_jobs")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("status", "paid");
        stats.paid_jobs = count || 0;
      }

      return stats;
    },
    enabled: !!user && !!currentAccount && cardIds.length > 0,
  });
}
