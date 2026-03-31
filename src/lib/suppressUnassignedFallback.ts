type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function isMissingSuppressUnassignedColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const dbError = error as DbErrorLike;
  const code = dbError.code || "";
  const message = (dbError.message || "").toLowerCase();
  const details = (dbError.details || "").toLowerCase();
  const hint = (dbError.hint || "").toLowerCase();
  const text = `${message} ${details} ${hint}`;

  // Postgres undefined_column and PostgREST missing schema cache column.
  if (code === "42703" || code === "PGRST204") {
    return text.includes("suppress_unassigned");
  }

  // Conservative fallback for providers that omit code.
  return (
    text.includes("suppress_unassigned") &&
    (text.includes("does not exist") || text.includes("schema cache"))
  );
}
