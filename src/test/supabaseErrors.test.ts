import { describe, expect, it } from "vitest";

import { isMissingRelationError } from "@/lib/supabaseErrors";

describe("isMissingRelationError", () => {
  it("matches Postgres missing relation code for a specific table", () => {
    expect(
      isMissingRelationError(
        {
          code: "42P01",
          message: 'relation "public.mock_crew_profiles" does not exist',
        },
        "mock_crew_profiles",
      ),
    ).toBe(true);
  });

  it("matches message-only missing relation errors", () => {
    expect(
      isMissingRelationError(
        {
          message: 'Could not find the table "mock_crew_profiles" in the schema cache',
        },
        "mock_crew_profiles",
      ),
    ).toBe(true);

    expect(
      isMissingRelationError(
        {
          message: 'relation "mock_crew_profiles" does not exist',
        },
        "mock_crew_profiles",
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(
      isMissingRelationError(
        {
          code: "42501",
          message: "new row violates row-level security policy",
        },
        "mock_crew_profiles",
      ),
    ).toBe(false);
  });
});
