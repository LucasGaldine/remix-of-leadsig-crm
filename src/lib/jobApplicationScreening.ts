export type JobApplicationScreeningInput = {
  reliableTransportation: boolean;
  availableFullTime: boolean;
  expectedHourlyPay: string;
  acceptableHourlyPayMin: number | null;
  acceptableHourlyPayMax: number | null;
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
  if (!input.reliableTransportation) {
    return {
      tag: "Reject",
      stage: "Pre-Screen Rejected",
      reason: "No reliable transportation",
    };
  }

  if (!input.availableFullTime) {
    return {
      tag: "Reject",
      stage: "Pre-Screen Rejected",
      reason: "Not available full-time",
    };
  }

  const expectedPayValue = parseExpectedPay(input.expectedHourlyPay);
  if (
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
