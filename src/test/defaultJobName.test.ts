import { describe, expect, it } from "vitest";

import { buildDefaultJobName } from "@/lib/defaultJobName";

describe("buildDefaultJobName", () => {
  it("builds a default regular job name using customer and service type", () => {
    expect(
      buildDefaultJobName({
        customerName: "John Smith",
        serviceType: "Lawn Care",
      }),
    ).toBe("John Smith, Lawn Care Job");
  });

  it("appends estimate visit for estimate jobs", () => {
    expect(
      buildDefaultJobName({
        customerName: "John Smith",
        serviceType: "Lawn Care",
        isEstimateVisit: true,
      }),
    ).toBe("John Smith, Lawn Care Job Estimate Visit");
  });

  it("falls back gracefully when service type is empty", () => {
    expect(
      buildDefaultJobName({
        customerName: "John Smith",
        serviceType: "",
      }),
    ).toBe("John Smith Job");
  });
});
