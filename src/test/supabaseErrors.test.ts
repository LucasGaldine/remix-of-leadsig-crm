import { describe, expect, it } from "vitest";

import {
  formatSupabaseDebugError,
  getJobAssignmentInsertErrorMessage,
  getSupabaseErrorMessage,
  isMissingColumnError,
  isMissingRelationError,
  isPermissionDeniedError,
} from "@/lib/supabaseErrors";

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

describe("getSupabaseErrorMessage", () => {
  it("returns message from plain object errors", () => {
    expect(
      getSupabaseErrorMessage({
        message: "new row violates row-level security policy for table job_assignments",
      }),
    ).toBe("new row violates row-level security policy for table job_assignments");
  });

  it("falls back when message is unavailable", () => {
    expect(getSupabaseErrorMessage({ code: "42501" }, "Fallback message")).toBe("Fallback message");
  });
});

describe("isPermissionDeniedError", () => {
  it("matches by postgres permission code", () => {
    expect(isPermissionDeniedError({ code: "42501", message: "permission denied for table job_assignments" })).toBe(
      true,
    );
  });

  it("matches by 403 status", () => {
    expect(isPermissionDeniedError({ status: 403, message: "Forbidden" })).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isPermissionDeniedError({ message: "network error" })).toBe(false);
  });
});

describe("getJobAssignmentInsertErrorMessage", () => {
  it("maps duplicate assignment to a specific message", () => {
    expect(
      getJobAssignmentInsertErrorMessage({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("This crew member is already assigned to this schedule.");
  });

  it("maps RLS policy violations to a descriptive permission/conflict message", () => {
    expect(
      getJobAssignmentInsertErrorMessage({
        code: "42501",
        message: "new row violates row-level security policy for table job_assignments",
      }),
    ).toBe(
      "Assignment blocked by permissions or schedule rules. Your role may not allow assignments, the assignee may be outside this account, or they may be double-booked.",
    );
  });
});

describe("formatSupabaseDebugError", () => {
  it("serializes known Supabase error fields", () => {
    expect(
      formatSupabaseDebugError({
        status: 403,
        code: "42501",
        message: "Forbidden",
        details: "new row violates row-level security policy",
        hint: null,
      }),
    ).toBe(
      '{"status":403,"code":"42501","message":"Forbidden","details":"new row violates row-level security policy","hint":null,"error_description":null}',
    );
  });
});
