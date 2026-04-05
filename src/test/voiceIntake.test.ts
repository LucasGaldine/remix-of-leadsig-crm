import { describe, expect, it } from "vitest";

import {
  matchServiceType,
  normalizeVoiceEstimateParsedData,
  normalizeVoiceJobParsedData,
  normalizeVoiceLeadParsedData,
} from "@/lib/voiceIntake";

describe("voiceIntake helpers", () => {
  it("normalizes lead intake values and strips empty strings", () => {
    const parsed = normalizeVoiceLeadParsedData({
      customerName: "  Jamie Stone  ",
      customerPhone: "  ",
      estimatedBudget: "$1,250",
      source: "Referral",
    });

    expect(parsed.customerName).toBe("Jamie Stone");
    expect(parsed.customerPhone).toBeUndefined();
    expect(parsed.estimatedBudget).toBe(1250);
    expect(parsed.source).toBe("Referral");
  });

  it("normalizes job intake values", () => {
    const parsed = normalizeVoiceJobParsedData({
      customerName: "Chris",
      serviceType: "Pressure Washing",
      description: "  Front and back patio  ",
    });

    expect(parsed.customerName).toBe("Chris");
    expect(parsed.serviceType).toBe("Pressure Washing");
    expect(parsed.description).toBe("Front and back patio");
  });

  it("normalizes estimate intake values including date and line items", () => {
    const parsed = normalizeVoiceEstimateParsedData({
      jobName: "Spring Cleanup",
      expiresAt: "2026-08-15T00:00:00.000Z",
      taxRate: "8.25%",
      lineItems: [
        {
          name: "Mulch",
          quantity: "2",
          unitPrice: "$120",
        },
      ],
    });

    expect(parsed.jobName).toBe("Spring Cleanup");
    expect(parsed.expiresAt).toBe("2026-08-15");
    expect(parsed.taxRate).toBe(8.25);
    expect(parsed.lineItems?.[0]).toMatchObject({
      name: "Mulch",
      quantity: 2,
      unitPrice: 120,
    });
  });

  it("matches service type by exact and fuzzy text", () => {
    const serviceTypes = ["Pressure Washing", "Window Cleaning", "Landscaping"];

    expect(matchServiceType("pressure washing", serviceTypes)).toBe("Pressure Washing");
    expect(matchServiceType("windows", serviceTypes)).toBe("Window Cleaning");
    expect(matchServiceType("unknown", serviceTypes)).toBe("");
  });
});
