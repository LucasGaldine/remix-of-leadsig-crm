import { describe, expect, it } from "vitest";
import { differenceInCalendarMonths, differenceInCalendarWeeks } from "date-fns";

import {
  DASHBOARD_MONTHS_TO_SHOW,
  DASHBOARD_WEEKS_TO_SHOW,
  getDashboardDateRange,
} from "@/hooks/dashboardVisualsDateRange";

describe("getDashboardDateRange", () => {
  it("returns a multi-week window for week timeframe", () => {
    const now = new Date(2026, 3, 2, 12, 0, 0);
    const { from, to } = getDashboardDateRange("week", now);

    expect(from.getDay()).toBe(1);
    expect(to.getDay()).toBe(0);
    expect(differenceInCalendarWeeks(to, from, { weekStartsOn: 1 })).toBe(DASHBOARD_WEEKS_TO_SHOW - 1);
  });

  it("returns a multi-month window for month timeframe", () => {
    const now = new Date(2026, 3, 2, 12, 0, 0);
    const { from, to } = getDashboardDateRange("month", now);

    expect(from.getDate()).toBe(1);
    expect(to.getTime()).toBe(now.getTime());
    expect(differenceInCalendarMonths(to, from)).toBe(DASHBOARD_MONTHS_TO_SHOW - 1);
  });
});
