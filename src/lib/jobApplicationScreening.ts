export type JobApplicationScreeningInput = {
  reliableTransportation: boolean;
  availableFullTime: boolean;
  expectedHourlyPay: string;
  acceptableHourlyPayMin: number | null;
  acceptableHourlyPayMax: number | null;
  autoReject?: {
    transportation_enabled?: boolean;
    availability_enabled?: boolean;
    pay_expectation_enabled?: boolean;
  };
};

export type JobApplicationScreeningResult = {
  tag: "Reject" | "Review" | "Qualified";
  stage: "Pre-Screen Rejected" | "Pre-Screen Review" | "Pre-Screen Qualified";
  reason: string;
};

function parseExpectedPay(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateJobApplicationScreening(
  input: JobApplicationScreeningInput,
): JobApplicationScreeningResult {
  const autoReject = {
    transportation_enabled: input.autoReject?.transportation_enabled ?? true,
    availability_enabled: input.autoReject?.availability_enabled ?? true,
    pay_expectation_enabled: input.autoReject?.pay_expectation_enabled ?? true,
  };

  if (autoReject.transportation_enabled && !input.reliableTransportation) {
    return {
      tag: "Reject",
      stage: "Pre-Screen Rejected",
      reason: "No reliable transportation",
    };
  }

  if (autoReject.availability_enabled && !input.availableFullTime) {
    return {
      tag: "Reject",
      stage: "Pre-Screen Rejected",
      reason: "Not available full-time",
    };
  }

  const expectedPayValue = parseExpectedPay(input.expectedHourlyPay);
  if (
    autoReject.pay_expectation_enabled &&
    input.acceptableHourlyPayMax !== null &&
    expectedPayValue !== null &&
    expectedPayValue > input.acceptableHourlyPayMax
  ) {
    return {
      tag: "Review",
      stage: "Pre-Screen Review",
      reason: "Expected pay above acceptable range",
    };
  }

  return {
    tag: "Qualified",
    stage: "Pre-Screen Qualified",
    reason: "Passed pre-screen rules",
  };
}
