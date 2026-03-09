import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { subDays, startOfWeek, endOfWeek, format } from "date-fns";

type Timeframe = "30d" | "week" | "month";

function getDateRange(tf: Timeframe) {
  const now = new Date();
  if (tf === "week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  if (tf === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: now };
  }
  return { from: subDays(now, 30), to: now };
}

export function useRevenueExpenses(timeframe: Timeframe) {
  const { currentAccount } = useAuth();
  const { from, to } = getDateRange(timeframe);

  return useQuery({
    queryKey: ["dashboard-revenue-expenses", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data } = await supabase
        .from("payments")
        .select("amount, type, recorded_at, created_at")
        .eq("account_id", currentAccount.id)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

      // Group by week
      const weeks: Record<string, { revenue: number; expenses: number }> = {};
      (data || []).forEach((p: any) => {
        const date = new Date(p.recorded_at || p.created_at);
        const weekKey = `W${Math.ceil(date.getDate() / 7)}`;
        if (!weeks[weekKey]) weeks[weekKey] = { revenue: 0, expenses: 0 };
        const amt = Number(p.amount) || 0;
        if (p.type === "expense") {
          weeks[weekKey].expenses += amt;
        } else {
          weeks[weekKey].revenue += amt;
        }
      });

      return Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, vals]) => ({ week, ...vals }));
    },
    enabled: !!currentAccount,
  });
}

export function useLeadFunnel(timeframe: Timeframe) {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-lead-funnel", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data } = await supabase
        .from("leads")
        .select("stage")
        .eq("account_id", currentAccount.id);

      const stages = ["new", "qualified", "approved", "won"];
      const counts: Record<string, number> = {};
      stages.forEach((s) => (counts[s] = 0));

      (data || []).forEach((l: any) => {
        const s = l.stage || "new";
        if (counts[s] !== undefined) counts[s]++;
      });

      return [
        { stage: "New Leads", count: counts.new },
        { stage: "Qualified", count: counts.qualified },
        { stage: "Approved", count: counts.approved },
        { stage: "Won", count: counts.won },
      ];
    },
    enabled: !!currentAccount,
  });
}

export function useJobCompletion(timeframe: Timeframe) {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-job-completion", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data } = await supabase
        .from("jobs")
        .select("status, delay_reason")
        .eq("account_id", currentAccount.id);

      let onTime = 0, delayed = 0, notCompleted = 0;
      (data || []).forEach((j: any) => {
        if (j.status === "completed" && !j.delay_reason) onTime++;
        else if (j.status === "completed" && j.delay_reason) delayed++;
        else notCompleted++;
      });

      const total = onTime + delayed + notCompleted || 1;
      return [
        { name: "On Time", value: Math.round((onTime / total) * 100), color: "hsl(var(--primary))" },
        { name: "Delayed", value: Math.round((delayed / total) * 100), color: "hsl(38 92% 50%)" },
        { name: "Not Completed", value: Math.round((notCompleted / total) * 100), color: "hsl(0 72% 51%)" },
      ];
    },
    enabled: !!currentAccount,
  });
}

export function usePlannedVsActual(timeframe: Timeframe) {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-planned-vs-actual", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data } = await supabase
        .from("jobs")
        .select("name, quoted_hours, actual_hours")
        .eq("account_id", currentAccount.id)
        .not("quoted_hours", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);

      return (data || []).map((j: any) => ({
        job: j.name || "Untitled",
        planned: Number(j.quoted_hours) || 0,
        actual: Number(j.actual_hours) || 0,
      }));
    },
    enabled: !!currentAccount,
  });
}

export function useCostVsQuoted(timeframe: Timeframe) {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-cost-vs-quoted", currentAccount?.id, timeframe],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data } = await supabase
        .from("jobs")
        .select("name, quoted_cost, actual_cost")
        .eq("account_id", currentAccount.id)
        .not("quoted_cost", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);

      return (data || []).map((j: any) => ({
        name: j.name || "Untitled",
        quoted: Number(j.quoted_cost) || 0,
        actual: Number(j.actual_cost) || 0,
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

      const { data } = await supabase
        .from("job_crew_assignments")
        .select("crew_member_id, hours_worked, date")
        .eq("account_id", currentAccount.id)
        .gte("date", format(from, "yyyy-MM-dd"))
        .lte("date", format(to, "yyyy-MM-dd"));

      // Get crew members for names
      const { data: members } = await supabase
        .from("crew_members")
        .select("id, name, role_type")
        .eq("account_id", currentAccount.id);

      const memberMap = new Map<string, { name: string; role: string }>();
      (members || []).forEach((m: any) => {
        memberMap.set(m.id, { name: m.name || "Unknown", role: m.role_type || "crew" });
      });

      const hoursByMember: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        const id = a.crew_member_id;
        hoursByMember[id] = (hoursByMember[id] || 0) + (Number(a.hours_worked) || 0);
      });

      return Object.entries(hoursByMember)
        .map(([id, hours]) => ({
          name: memberMap.get(id)?.name || "Unknown",
          role: memberMap.get(id)?.role === "lead" ? "Lead" : "Crew",
          hours: Math.round(hours * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);
    },
    enabled: !!currentAccount,
  });
}
