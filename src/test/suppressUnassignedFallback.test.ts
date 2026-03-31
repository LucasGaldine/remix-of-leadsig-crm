import { describe, expect, it } from "vitest";

import { isMissingSuppressUnassignedColumn } from "@/lib/suppressUnassignedFallback";

describe("isMissingSuppressUnassignedColumn", () => {
  it("returns true for undefined-column errors on suppress_unassigned", () => {
    expect(
      isMissingSuppressUnassignedColumn({
        code: "42703",
        message: 'column "suppress_unassigned" does not exist',
      }),
    ).toBe(true);
  });

  it("returns false for non-schema errors mentioning suppress_unassigned", () => {
    expect(
      isMissingSuppressUnassignedColumn({
        code: "42501",
        message: "new row violates row-level security policy for table job_schedules (suppress_unassigned)",
      }),
    ).toBe(false);
  });
});
