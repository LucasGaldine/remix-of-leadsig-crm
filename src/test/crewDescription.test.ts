import { describe, expect, it } from "vitest";

import { CREW_DESCRIPTION_MAX_LENGTH, normalizeCrewDescription } from "@/lib/crewDescription";

describe("normalizeCrewDescription", () => {
  it("returns null when the input is empty", () => {
    expect(normalizeCrewDescription("   ")).toBeNull();
    expect(normalizeCrewDescription(null)).toBeNull();
    expect(normalizeCrewDescription(undefined)).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCrewDescription("  Fast at trim work  ")).toBe("Fast at trim work");
  });

  it("caps descriptions at the maximum length", () => {
    const longValue = "a".repeat(CREW_DESCRIPTION_MAX_LENGTH + 25);
    expect(normalizeCrewDescription(longValue)).toHaveLength(CREW_DESCRIPTION_MAX_LENGTH);
  });
});
