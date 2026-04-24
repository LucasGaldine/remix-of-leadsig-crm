import { describe, expect, it } from "vitest";
import { evaluateJobApplicationScreening } from "@/lib/jobApplicationScreening";

describe("evaluateJobApplicationScreening", () => {
  it("rejects when reliable transportation is false", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: false,
      availableFullTime: true,
      expectedHourlyPay: "$20",
      acceptableHourlyPayMin: null,
      acceptableHourlyPayMax: 35,
    });

    expect(result.tag).toBe("Reject");
    expect(result.stage).toBe("Pre-Screen Rejected");
  });

  it("rejects when full-time availability is false", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: true,
      availableFullTime: false,
      expectedHourlyPay: "$20",
      acceptableHourlyPayMin: null,
      acceptableHourlyPayMax: 35,
    });

    expect(result.tag).toBe("Reject");
    expect(result.stage).toBe("Pre-Screen Rejected");
  });

  it("marks review when expected pay is above max acceptable range", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: true,
      availableFullTime: true,
      expectedHourlyPay: "$45/hr",
      acceptableHourlyPayMin: 18,
      acceptableHourlyPayMax: 35,
    });

    expect(result.tag).toBe("Review");
    expect(result.stage).toBe("Pre-Screen Review");
  });

  it("marks qualified when no reject or review conditions match", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: true,
      availableFullTime: true,
      expectedHourlyPay: "$25/hr",
      acceptableHourlyPayMin: 18,
      acceptableHourlyPayMax: 35,
    });

    expect(result.tag).toBe("Qualified");
    expect(result.stage).toBe("Pre-Screen Qualified");
  });

  it("ignores transportation when that filter is disabled", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: false,
      availableFullTime: true,
      expectedHourlyPay: "$20",
      acceptableHourlyPayMin: null,
      acceptableHourlyPayMax: 35,
      autoReject: {
        transportation_enabled: false,
        availability_enabled: true,
        pay_expectation_enabled: true,
      },
    });

    expect(result.tag).toBe("Qualified");
    expect(result.stage).toBe("Pre-Screen Qualified");
  });

  it("ignores availability when that filter is disabled", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: true,
      availableFullTime: false,
      expectedHourlyPay: "$20",
      acceptableHourlyPayMin: null,
      acceptableHourlyPayMax: 35,
      autoReject: {
        transportation_enabled: true,
        availability_enabled: false,
        pay_expectation_enabled: true,
      },
    });

    expect(result.tag).toBe("Qualified");
    expect(result.stage).toBe("Pre-Screen Qualified");
  });

  it("ignores pay expectation when that filter is disabled", () => {
    const result = evaluateJobApplicationScreening({
      reliableTransportation: true,
      availableFullTime: true,
      expectedHourlyPay: "$45/hr",
      acceptableHourlyPayMin: 18,
      acceptableHourlyPayMax: 35,
      autoReject: {
        transportation_enabled: true,
        availability_enabled: true,
        pay_expectation_enabled: false,
      },
    });

    expect(result.tag).toBe("Qualified");
    expect(result.stage).toBe("Pre-Screen Qualified");
  });
});
