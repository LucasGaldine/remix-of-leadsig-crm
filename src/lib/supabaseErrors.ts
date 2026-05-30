export interface SupabaseLikeError {
  message?: string | null;
  code?: string | null;
  status?: number | null;
  details?: string | null;
  hint?: string | null;
  error_description?: string | null;
}

export function getSupabaseErrorMessage(error: unknown, fallback = "Unexpected error"): string {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    return message || fallback;
  }

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeError = error as SupabaseLikeError;
  const message = String(maybeError.message || "").trim();
  if (message) {
    return message;
  }

  const description = String(maybeError.error_description || "").trim();
  if (description) {
    return description;
  }

  const details = String(maybeError.details || "").trim();
  if (details) {
    return details;
  }

  const hint = String(maybeError.hint || "").trim();
  if (hint) {
    return hint;
  }

  return fallback;
}

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as SupabaseLikeError;
  const code = String(maybeError.code || "").trim();
  const status = Number(maybeError.status || 0);
  const message = String(getSupabaseErrorMessage(error, "")).toLowerCase();

  if (code === "42501" || status === 403) {
    return true;
  }

  return (
    message.includes("forbidden") ||
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("policy")
  );
}

export function getJobAssignmentInsertErrorMessage(error: unknown): string {
  const fallback =
    "Unable to assign this crew member. Verify your role allows assignments, the assignee belongs to this account, and they are not already booked.";
  const message = getSupabaseErrorMessage(error, "").toLowerCase();

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeError = error as SupabaseLikeError;
  const code = String(maybeError.code || "").trim();
  const details = String(maybeError.details || "").toLowerCase();

  if (code === "23505") {
    return "This crew member is already assigned to this schedule.";
  }

  if (code === "23503") {
    return "Assignment failed because a referenced record was not found. Refresh and try again.";
  }

  if (code === "23514") {
    return "Assignment failed validation. Choose exactly one assignee and make sure they belong to this account.";
  }

  if (isPermissionDeniedError(error)) {
    if (message.includes("row-level security") || message.includes("policy")) {
      return "Assignment blocked by permissions or schedule rules. Your role may not allow assignments, the assignee may be outside this account, or they may be double-booked.";
    }
    return "Assignment was forbidden by the database. Your role may not allow assigning crew for this account, or this assignment violates account/schedule rules.";
  }

  if (details.includes("job_assignments_schedule_user_unique") || details.includes("job_assignments_schedule_mock_unique")) {
    return "This crew member is already assigned to this schedule.";
  }

  return fallback;
}

export function formatSupabaseDebugError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "unknown error object";
  }

  const maybeError = error as SupabaseLikeError;
  const debug = {
    status: maybeError.status ?? null,
    code: maybeError.code ?? null,
    message: maybeError.message ?? null,
    details: maybeError.details ?? null,
    hint: maybeError.hint ?? null,
    error_description: maybeError.error_description ?? null,
  };

  return JSON.stringify(debug);
}

export function isMissingRelationError(error: SupabaseLikeError | null | undefined, relationName?: string): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code || "").trim();
  const message = String(error.message || "").toLowerCase();

  if (code === "42P01") {
    return relationName ? message.includes(relationName.toLowerCase()) : true;
  }

  const isMissingRelationMessage =
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache");

  if (!isMissingRelationMessage) {
    return false;
  }

  return relationName ? message.includes(relationName.toLowerCase()) : true;
}

export function isMissingColumnError(
  error: SupabaseLikeError | null | undefined,
  columnName?: string,
  relationName?: string,
): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code || "").trim();
  const message = String(error.message || "").toLowerCase();

  if (code === "42703") {
    if (columnName && !message.includes(columnName.toLowerCase())) {
      return false;
    }
    return relationName ? message.includes(relationName.toLowerCase()) : true;
  }

  const mentionsMissingColumn = message.includes("column") && message.includes("does not exist");
  const mentionsSchemaCache = message.includes("schema cache") && message.includes("column");

  if (!mentionsMissingColumn && !mentionsSchemaCache) {
    return false;
  }

  if (columnName && !message.includes(columnName.toLowerCase())) {
    return false;
  }

  return relationName ? message.includes(relationName.toLowerCase()) : true;
}
