export const DEFAULT_AFFILIATE_COMMISSION_RATE = 0.2;

export function extractAffiliateReferralCode(search: string): string | null {
  const params = new URLSearchParams(search);
  const rawCode = params.get("ref") ?? params.get("affiliate_code");

  if (!rawCode) {
    return null;
  }

  const normalized = rawCode.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function calculateAffiliateCommission(
  revenueAmount: number,
  commissionRate: number = DEFAULT_AFFILIATE_COMMISSION_RATE,
): number {
  if (!Number.isFinite(revenueAmount) || revenueAmount <= 0) {
    return 0;
  }

  if (!Number.isFinite(commissionRate) || commissionRate <= 0) {
    return 0;
  }

  return Math.round((revenueAmount * commissionRate + Number.EPSILON) * 100) / 100;
}
