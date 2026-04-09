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
