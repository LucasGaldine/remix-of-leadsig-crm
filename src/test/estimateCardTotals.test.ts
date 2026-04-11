import { describe, expect, it } from "vitest";

import { getEstimateCardTotal } from "@/lib/estimateCardTotals";

describe("getEstimateCardTotal", () => {
  it("uses accepted estimate total directly", () => {
    expect(
      getEstimateCardTotal({
        status: "accepted",
        total: 2450,
        versions: [{ total: 1200 }, { total: 1900 }],
      }),
    ).toBe(2450);
  });

  it("uses the lowest version total for non-accepted estimates when versions exist", () => {
    expect(
      getEstimateCardTotal({
        status: "draft",
        total: 2600,
        versions: [{ total: 1800 }, { total: 1500 }, { total: 2100 }],
      }),
    ).toBe(1500);
  });

  it("falls back to estimate total when versions are missing", () => {
    expect(
      getEstimateCardTotal({
        status: "draft",
        total: 900,
        versions: [],
      }),
    ).toBe(900);
  });
});
