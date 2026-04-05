export interface SupabaseLikeError {
  message?: string | null;
  code?: string | null;
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
