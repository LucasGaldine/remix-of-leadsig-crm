export type PlanKey = "free" | "basic" | "premium";
export type BasicTier = "solo" | "team" | "growth";

export const BASIC_TIERS: BasicTier[] = ["solo", "team", "growth"];
export const PAID_PLANS: PlanKey[] = ["basic", "premium"];

export const BASIC_TIER_MONTHLY_PRICE_CENTS: Record<BasicTier, number> = {
  solo: 2900,
  team: 11900,
  growth: 19700,
};

export const BASIC_TIER_MEMBER_CAP: Record<BasicTier, number | null> = {
  solo: 1,
  team: 5,
  growth: null,
};

export const PREMIUM_MONTHLY_PRICE_CENTS = 199700;
export const PREMIUM_SETUP_FEE_CENTS = 300000;

export function isPlanKey(value: string | null | undefined): value is PlanKey {
  return value === "free" || value === "basic" || value === "premium";
}

export function isBasicTier(value: string | null | undefined): value is BasicTier {
  return value === "solo" || value === "team" || value === "growth";
}

export function normalizePlan(value: string | null | undefined, fallback: PlanKey = "basic"): PlanKey {
  const normalized = (value ?? "").trim().toLowerCase();
  return isPlanKey(normalized) ? normalized : fallback;
}

export function normalizeBasicTier(value: string | null | undefined, fallback: BasicTier = "solo"): BasicTier {
  const normalized = (value ?? "").trim().toLowerCase();
  return isBasicTier(normalized) ? normalized : fallback;
}

export function getMonthlyAmountCents(plan: PlanKey, tier: BasicTier | null): number {
  if (plan === "free") return 0;
  if (plan === "premium") return PREMIUM_MONTHLY_PRICE_CENTS;
  if (!tier) throw new Error("Basic tier is required for basic pricing");
  return BASIC_TIER_MONTHLY_PRICE_CENTS[tier];
}

