import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { subDays, startOfWeek, endOfWeek, format, differenceInMinutes } from "date-fns";

type Timeframe = "week" | "month";

function getDateRange(tf: Timeframe) {
  const now = new Date();
  if (tf === "week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from, to: now };
}

const isMissingTable = (error: any) =>
  error?.code === "PGRST205" || error?.message?.toLowerCase?.().includes("does not exist");

const parseTimeToMinutes = (time?: string | null) => {
  if (!time) return 8 * 60; // sensible default workday
  const [h, m, s] = time.split(":").map((v) => Number(v) || 0);
  return h * 60 + m + s / 60;
};

const computeScheduleHours = (start?: string | null, end?: string | null) => {
  const minutes = Math.max(parseTimeToMinutes(end) - parseTimeToMinutes(start), 60); // at least 1h
  return minutes / 60;
};

export function useRevenueExpenses(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-revenue-expenses", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const [paymentsRes, jobsRes] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, created_at")
          .eq("account_id", currentAccount.id)
          .eq("status", "completed")
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
        supabase
          .from("leads")
          .select("id, updated_at")
          .eq("account_id", currentAccount.id)
          .eq("status", "completed")
          .gte("updated_at", from.toISOString())
          .lte("updated_at", to.toISOString()),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (jobsRes.error) throw jobsRes.error;

      const jobIds = (jobsRes.data || []).map((j: any) => j.id);

      let lineItemsRes = null;
      if (jobIds.length > 0) {
        lineItemsRes = await supabase
          .from("job_line_items")
          .select("lead_id, total")
          .eq("account_id", currentAccount.id)
          .in("lead_id", jobIds);

        if (lineItemsRes.error && !isMissingTable(lineItemsRes.error)) throw lineItemsRes.error;
      }

      const weeks: Record<string, { revenue: number; expenses: number; order: number }> = {};

      (paymentsRes.data || []).forEach((p: any) => {
        const date = new Date(p.created_at);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, "MMM d");
        if (!weeks[weekKey]) weeks[weekKey] = { revenue: 0, expenses: 0, order: weekStart.getTime() };
        const amt = Number(p.amount) || 0;
        weeks[weekKey].revenue += amt;
      });

      const jobDateMap = new Map((jobsRes.data || []).map((j: any) => [j.id, j.updated_at]));

      (lineItemsRes?.data || []).forEach((item: any) => {
        if (!item.lead_id) return;

        const jobDate = jobDateMap.get(item.lead_id);
        if (!jobDate) return;

        const date = new Date(jobDate);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, "MMM d");
        if (!weeks[weekKey]) weeks[weekKey] = { revenue: 0, expenses: 0, order: weekStart.getTime() };

        const cost = Number(item.total) || 0;
        weeks[weekKey].expenses += cost;
      });

      return Object.entries(weeks)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([week, vals]) => ({ week, revenue: vals.revenue, expenses: vals.expenses }));
    },
    enabled: !!currentAccount,
  });
}

export function useLeadFunnel(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-lead-funnel", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("status, created_at")
        .eq("account_id", currentAccount.id)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

      if (error) throw error;

      const stages = [
        { key: "new", label: "New Leads" },
        { key: "contacted", label: "Contacted" },
        { key: "qualified", label: "Qualified" },
        { key: "job", label: "Jobs" },
        { key: "completed", label: "Won" },
      ] as const;

      const counts: Record<string, number> = {};
      stages.forEach((s) => (counts[s.key] = 0));

      (data || []).forEach((l: any) => {
        const status = l.status || "new";
        if (counts[status] !== undefined) counts[status]++;
      });

      return stages.map((s) => ({ stage: s.label, count: counts[s.key] || 0 }));
    },
    enabled: !!currentAccount,
  });
}

export function useJobCompletion(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-job-completion", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const [leadRes, scheduleRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, status, created_at")
          .eq("account_id", currentAccount.id)
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString()),
        supabase
          .from("job_schedules")
          .select("lead_id, scheduled_date, scheduled_time_end")
          .eq("account_id", currentAccount.id),
      ]);

      if (leadRes.error) throw leadRes.error;
      if (scheduleRes.error && !isMissingTable(scheduleRes.error)) throw scheduleRes.error;

      const scheduleMap = new Map<string, Date>();
      (scheduleRes.data || []).forEach((s: any) => {
        if (!s.lead_id || !s.scheduled_date) return;
        const endDate = new Date(
          `${s.scheduled_date}T${s.scheduled_time_end || "23:59:59"}`
        );
        const existing = scheduleMap.get(s.lead_id);
        if (!existing || endDate > existing) {
          scheduleMap.set(s.lead_id, endDate);
        }
      });

      let completed = 0, overdue = 0, open = 0;
      const now = new Date();

      (leadRes.data || []).forEach((lead: any) => {
        const status = lead.status;
        const isDone = ["completed"].includes(status);
        if (isDone) {
          completed++;
          return;
        }

        const lastSchedule = scheduleMap.get(lead.id);
        if (lastSchedule && lastSchedule < now) {
          overdue++;
        } else {
          open++;
        }
      });

      const total = Math.max(completed + overdue + open, 1);
      return [
        { name: "Completed", value: Math.round((completed / total) * 100), color: "hsl(var(--primary))" },
        { name: "Overdue", value: Math.round((overdue / total) * 100), color: "hsl(38 92% 50%)" },
        { name: "Open", value: Math.round((open / total) * 100), color: "hsl(0 72% 51%)" },
      ];
    },
    enabled: !!currentAccount,
  });
}

export function usePlannedVsActual(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-planned-vs-actual", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const fromDate = format(from, "yyyy-MM-dd");
      const toDate = format(to, "yyyy-MM-dd");

      const [scheduleRes, timeRes] = await Promise.all([
        supabase
          .from("job_schedules")
          .select("lead_id, scheduled_date, scheduled_time_start, scheduled_time_end, leads!inner(name)")
          .eq("account_id", currentAccount.id)
          .gte("scheduled_date", fromDate)
          .lte("scheduled_date", toDate),
        supabase
          .from("job_time_entries")
          .select("lead_id, clock_in, clock_out")
          .eq("account_id", currentAccount.id)
          .gte("clock_in", from.toISOString())
          .lte("clock_in", to.toISOString()),
      ]);

      if (scheduleRes.error && !isMissingTable(scheduleRes.error)) throw scheduleRes.error;
      if (timeRes.error && !isMissingTable(timeRes.error)) throw timeRes.error;

      const planned = new Map<string, number>();
      const nameMap = new Map<string, string>();

      (scheduleRes.data || []).forEach((s: any) => {
        if (!s.lead_id) return;
        const hours = computeScheduleHours(s.scheduled_time_start, s.scheduled_time_end);
        planned.set(s.lead_id, (planned.get(s.lead_id) || 0) + hours);
        if (s.leads?.name) nameMap.set(s.lead_id, s.leads.name);
      });

      const actual = new Map<string, number>();
      (timeRes.data || []).forEach((t: any) => {
        if (!t.lead_id || !t.clock_in) return;
        const start = new Date(t.clock_in);
        const end = t.clock_out ? new Date(t.clock_out) : new Date();
        const mins = Math.max(0, differenceInMinutes(end, start));
        actual.set(t.lead_id, (actual.get(t.lead_id) || 0) + mins / 60);
      });

      const leadIds = Array.from(new Set([...planned.keys(), ...actual.keys()]));
      if (leadIds.length === 0) return [];

      const missingNames = leadIds.filter((id) => !nameMap.has(id));
      if (missingNames.length > 0) {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, name")
          .in("id", missingNames)
          .eq("account_id", currentAccount.id);
        if (error) throw error;
        (leads || []).forEach((l: any) => nameMap.set(l.id, l.name || "Untitled"));
      }

      return leadIds
        .map((id) => ({
          job: nameMap.get(id) || "Untitled",
          planned: Math.round((planned.get(id) || 0) * 10) / 10,
          actual: Math.round((actual.get(id) || 0) * 10) / 10,
        }))
        .sort((a, b) => (b.actual + b.planned) - (a.actual + a.planned))
        .slice(0, 6);
    },
    enabled: !!currentAccount,
  });
}

export function useCostVsQuoted(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-cost-vs-quoted", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("name, estimated_value, actual_value, updated_at")
        .eq("account_id", currentAccount.id)
        .not("estimated_value", "is", null)
        .gte("updated_at", from.toISOString())
        .lte("updated_at", to.toISOString())
        .order("updated_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      return (data || []).map((lead: any) => ({
        name: lead.name || "Untitled",
        quoted: Number(lead.estimated_value) || 0,
        actual: Number(lead.actual_value) || 0,
      }));
    },
    enabled: !!currentAccount,
  });
}

export function useCrewHours(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-crew-hours", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data: entries, error } = await supabase
        .from("job_time_entries")
        .select("user_id, clock_in, clock_out")
        .eq("account_id", currentAccount.id)
        .gte("clock_in", from.toISOString())
        .lte("clock_in", to.toISOString());

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }

      const hoursByUser: Record<string, number> = {};
      (entries || []).forEach((e: any) => {
        if (!e.user_id || !e.clock_in) return;
        const start = new Date(e.clock_in);
        const end = e.clock_out ? new Date(e.clock_out) : new Date();
        const mins = Math.max(0, differenceInMinutes(end, start));
        hoursByUser[e.user_id] = (hoursByUser[e.user_id] || 0) + mins / 60;
      });

      const userIds = Object.keys(hoursByUser);
      if (userIds.length === 0) return [];

      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase
          .from("account_members")
          .select("user_id, role")
          .eq("account_id", currentAccount.id)
          .in("user_id", userIds),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (membersRes.error) throw membersRes.error;

      const nameMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name || "Unknown"));

      const roleMap = new Map<string, string>();
      (membersRes.data || []).forEach((m: any) => roleMap.set(m.user_id, m.role));

      return userIds
        .map((id) => ({
          name: nameMap.get(id) || "Unknown",
          role: ["owner", "admin", "crew_lead"].includes((roleMap.get(id) || "").toLowerCase()) ? "Lead" : "Crew",
          hours: Math.round((hoursByUser[id] || 0) * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);
    },
    enabled: !!currentAccount,
  });
}
