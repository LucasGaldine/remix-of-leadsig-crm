export type PlanKey = "free" | "basic" | "premium";
export type BasicTier = "solo" | "team" | "growth";

export interface BasicTierConfig {
  priceMonthly: number;
  seatLabel: string;
  maxMembers: number | null;
}

export const BASIC_TIER_CONFIG: Record<BasicTier, BasicTierConfig> = {
  solo: {
    priceMonthly: 29,
    seatLabel: "1 user",
    maxMembers: 1,
  },
  team: {
    priceMonthly: 119,
    seatLabel: "2-5 users",
    maxMembers: 5,
  },
  growth: {
    priceMonthly: 197,
    seatLabel: "6+ users",
    maxMembers: null,
  },
};

export function getBasicTierMonthlyPrice(tier: BasicTier): number {
  return BASIC_TIER_CONFIG[tier].priceMonthly;
}

export function getBasicTierSeatLabel(tier: BasicTier): string {
  return BASIC_TIER_CONFIG[tier].seatLabel;
}

export function hasLandscapingSkoolAccess(plan: PlanKey, tier: BasicTier | null): boolean {
  if (plan === "premium") {
    return true;
  }

  return plan === "basic" && tier === "growth";
}
