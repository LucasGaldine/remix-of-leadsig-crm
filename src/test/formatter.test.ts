import { describe, expect, it } from "vitest";

import { roundCurrencyAmount } from "@/lib/formatter";

describe("roundCurrencyAmount", () => {
  it("rounds floating point residue to cents", () => {
    expect(roundCurrencyAmount(0.7199999999999998)).toBe(0.72);
  });

  it("keeps standard two-decimal currency values unchanged", () => {
    expect(roundCurrencyAmount(125.34)).toBe(125.34);
  });
});
