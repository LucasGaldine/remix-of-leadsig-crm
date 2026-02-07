export type PricingPlan = 'free' | 'basic' | 'premium';

const planTier: Record<PricingPlan, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export function hasPlanAccess(currentPlan: PricingPlan, requiredPlan: PricingPlan): boolean {
  return planTier[currentPlan] >= planTier[requiredPlan];
}

export const planNames: Record<PricingPlan, string> = {
  free: 'Free',
  basic: 'Basic',
  premium: 'Premium',
};
