import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

export function useDashboardStats(cardIds: string[]) {
  const { user, currentAccount } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

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

      if (needed.has("total_jobs")) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentAccount.id)
          .eq("approval_status", "approved")
          .in("status", ["job", "paid", "completed"]);
        stats.total_jobs = count || 0;
      }

      if (needed.has("todays_jobs")) {
        const { data } = await supabase
          .from("job_schedules")
          .select("lead_id, leads!lead_id(account_id)")
          .eq("scheduled_date", today);
        const filtered = (data || []).filter(
          (d: any) => d.leads?.account_id === currentAccount.id
        );
        const uniqueJobs = new Set(filtered.map((d: any) => d.lead_id));
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

      if (needed.has("unassigned_jobs")) {
        const { data } = await supabase
          .from("leads")
          .select("id, job_schedules!lead_id(id), job_assignments!lead_id(id)")
          .eq("account_id", currentAccount.id)
          .eq("status", "job");

        let count = 0;
        (data || []).forEach((job: any) => {
          const hasSchedules = (job.job_schedules || []).length > 0;
          const hasAssignments = (job.job_assignments || []).length > 0;
          if (hasSchedules && !hasAssignments) count++;
        });
        stats.unassigned_jobs = count;
      }

      if (needed.has("overdue_jobs")) {
        const { data } = await supabase
          .from("leads")
          .select("id, status, job_schedules!lead_id(scheduled_date, scheduled_time_end)")
          .eq("account_id", currentAccount.id)
          .eq("status", "job");

        let count = 0;
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
          if (now > endDt) count++;
        });
        stats.overdue_jobs = count;
      }

      if (needed.has("estimates_needs_review")) {
        const { data: estimates } = await supabase
          .from("estimates")
          .select("id, status, job:leads!estimates_job_id_fkey(estimate_job_id)")
          .eq("account_id", currentAccount.id)
          .not("status", "in", '("accepted","declined")');

        const estimateJobIds = (estimates || [])
          .map((e: any) => e.job?.estimate_job_id)
          .filter(Boolean);

        if (estimateJobIds.length > 0) {
          const { data: ejData } = await supabase
            .from("leads")
            .select("id")
            .in("id", [...new Set(estimateJobIds)])
            .eq("status", "completed");

          const completedIds = new Set((ejData || []).map((ej: any) => ej.id));
          stats.estimates_needs_review = (estimates || []).filter(
            (e: any) => e.job?.estimate_job_id && completedIds.has(e.job.estimate_job_id)
          ).length;
        } else {
          stats.estimates_needs_review = 0;
        }
      }

      return stats;
    },
    enabled: !!user && !!currentAccount && cardIds.length > 0,
  });
}
