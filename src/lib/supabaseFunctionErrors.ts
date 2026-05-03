import { FunctionsHttpError } from "@supabase/supabase-js";

export async function getFunctionErrorMessage(
  error: unknown,
  fallback = "Request failed. Please try again.",
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: string; message?: string } | null;
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
      // Ignore JSON parse issues and use fallback below.
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

