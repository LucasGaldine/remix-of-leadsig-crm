import { describe, expect, it } from "vitest";

import { calculateAffiliateCommission, extractAffiliateReferralCode } from "@/lib/affiliate";

describe("extractAffiliateReferralCode", () => {
  it("returns null when no referral query param exists", () => {
    expect(extractAffiliateReferralCode("")).toBeNull();
    expect(extractAffiliateReferralCode("?foo=bar")).toBeNull();
  });

  it("returns an uppercased referral code", () => {
    expect(extractAffiliateReferralCode("?ref=abc123")).toBe("ABC123");
    expect(extractAffiliateReferralCode("?ref=  Lead-Sig-01  ")).toBe("LEAD-SIG-01");
  });

  it("supports affiliate_code as a fallback query param", () => {
    expect(extractAffiliateReferralCode("?affiliate_code=partner999")).toBe("PARTNER999");
  });
});

describe("calculateAffiliateCommission", () => {
  it("calculates 20 percent commission with currency rounding", () => {
    expect(calculateAffiliateCommission(100)).toBe(20);
    expect(calculateAffiliateCommission(17.89)).toBe(3.58);
  });

  it("returns zero for non-positive revenue", () => {
    expect(calculateAffiliateCommission(0)).toBe(0);
    expect(calculateAffiliateCommission(-50)).toBe(0);
  });

  it("accepts a custom commission rate", () => {
    expect(calculateAffiliateCommission(100, 0.15)).toBe(15);
  });
});
