import { describe, expect, it } from "vitest";

import { isMissingColumnError, isMissingRelationError } from "@/lib/supabaseErrors";

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

describe("isMissingColumnError", () => {
  it("matches undefined column code for a specific column and table", () => {
    expect(
      isMissingColumnError(
        {
          code: "42703",
          message: 'column "description" of relation "account_members" does not exist',
        },
        "description",
        "account_members",
      ),
    ).toBe(true);
  });

  it("matches schema cache missing column errors", () => {
    expect(
      isMissingColumnError(
        {
          message: 'Could not find the column "description" of "account_members" in the schema cache',
        },
        "description",
        "account_members",
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(
      isMissingColumnError(
        {
          code: "42501",
          message: "new row violates row-level security policy",
        },
        "description",
        "account_members",
      ),
    ).toBe(false);
  });
});
