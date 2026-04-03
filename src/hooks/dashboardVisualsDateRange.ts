import { subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth } from "date-fns";

export type DashboardVisualsTimeframe = "week" | "month";

export const DASHBOARD_WEEKS_TO_SHOW = 6;
export const DASHBOARD_MONTHS_TO_SHOW = 6;

export function getDashboardDateRange(tf: DashboardVisualsTimeframe, now = new Date()) {
  if (tf === "week") {
    const from = startOfWeek(subWeeks(now, DASHBOARD_WEEKS_TO_SHOW - 1), { weekStartsOn: 1 });
    const to = endOfWeek(now, { weekStartsOn: 1 });
    return { from, to };
  }

  const from = startOfMonth(subMonths(now, DASHBOARD_MONTHS_TO_SHOW - 1));
  return { from, to: now };
}
