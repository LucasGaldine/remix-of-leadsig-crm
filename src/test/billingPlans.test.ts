import { describe, expect, it } from "vitest";

import {
  BASIC_TIER_CONFIG,
  getBasicTierMonthlyPrice,
  getBasicTierSeatLabel,
  hasLandscapingSkoolAccess,
  type BasicTier,
} from "@/lib/billingPlans";

describe("billing plan helpers", () => {
  it("maps each basic tier to the agreed monthly amount", () => {
    const tiers: BasicTier[] = ["solo", "team", "growth"];
    const expected = [29, 119, 197];

    tiers.forEach((tier, index) => {
      expect(getBasicTierMonthlyPrice(tier)).toBe(expected[index]);
    });
  });

  it("exposes human-readable seat labels", () => {
    expect(getBasicTierSeatLabel("solo")).toBe("1 user");
    expect(getBasicTierSeatLabel("team")).toBe("2-5 users");
    expect(getBasicTierSeatLabel("growth")).toBe("6+ users");
  });

  it("grants Landscaping Skool only to basic growth and premium", () => {
    expect(hasLandscapingSkoolAccess("basic", "solo")).toBe(false);
    expect(hasLandscapingSkoolAccess("basic", "team")).toBe(false);
    expect(hasLandscapingSkoolAccess("basic", "growth")).toBe(true);
    expect(hasLandscapingSkoolAccess("premium", null)).toBe(true);
    expect(hasLandscapingSkoolAccess("free", null)).toBe(false);
  });

  it("documents seat caps for enforceable tiers", () => {
    expect(BASIC_TIER_CONFIG.solo.maxMembers).toBe(1);
    expect(BASIC_TIER_CONFIG.team.maxMembers).toBe(5);
    expect(BASIC_TIER_CONFIG.growth.maxMembers).toBeNull();
  });
});
