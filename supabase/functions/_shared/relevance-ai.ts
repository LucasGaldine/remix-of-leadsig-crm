const RELEVANCE_AI_STUDIO_ID = "d50e7c9d-7933-47c5-b284-9295b3faf020";
const RELEVANCE_AI_PROJECT_ID = "a8f61433-8567-40b3-a274-8c65d6d9a062";

const DEFAULT_RELEVANCE_AI_TIMEOUT_MS = 45_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

export type RelevanceAiParseResult<TOutput> = {
  data: TOutput;
  timeoutMs: number;
};

export class RelevanceAiTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Relevance AI API timeout after ${timeoutMs}ms`);
    this.name = "RelevanceAiTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

function clampTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_RELEVANCE_AI_TIMEOUT_MS;
  const rounded = Math.floor(timeoutMs);
  if (rounded < MIN_TIMEOUT_MS) return MIN_TIMEOUT_MS;
  if (rounded > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
  return rounded;
}

export function resolveRelevanceAiTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === "number") {
    return clampTimeout(timeoutMs);
  }

  const denoGlobal = globalThis as { Deno?: { env?: { get: (name: string) => string | undefined } } };
  const configured = denoGlobal.Deno?.env?.get("RELEVANCE_AI_TIMEOUT_MS");
  if (!configured) return DEFAULT_RELEVANCE_AI_TIMEOUT_MS;

  const parsed = Number.parseInt(configured, 10);
  return clampTimeout(parsed);
}

export function isRelevanceAiTimeoutError(error: unknown): error is RelevanceAiTimeoutError {
  return error instanceof RelevanceAiTimeoutError;
}

export async function parseLeadWithRelevanceAi<TOutput>(
  rawPayload: unknown,
  apiKey: string,
  timeoutMs?: number,
): Promise<RelevanceAiParseResult<TOutput>> {
  const resolvedTimeoutMs = resolveRelevanceAiTimeoutMs(timeoutMs);
  const endpoint = `https://api-bcbe5a.stack.tryrelevance.com/latest/studios/${RELEVANCE_AI_STUDIO_ID}/trigger_webhook?project=${RELEVANCE_AI_PROJECT_ID}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolvedTimeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({ lead_data: rawPayload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const data = result.answer ? JSON.parse(result.answer) : (result.output || result);
    return { data: data as TOutput, timeoutMs: resolvedTimeoutMs };
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbortError = (error instanceof Error && error.name === "AbortError")
      || (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError");

    if (isAbortError) {
      throw new RelevanceAiTimeoutError(resolvedTimeoutMs);
    }
    if (error instanceof SyntaxError) {
      throw new Error("AI returned invalid JSON format");
    }
    throw error;
  }
}
