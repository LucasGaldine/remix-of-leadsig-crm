import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFallbackInteractionPayload,
  buildFallbackLeadInsertValues,
} from "../../supabase/functions/_shared/lead-ingestion-fallback";
import {
  RelevanceAiTimeoutError,
  isRelevanceAiTimeoutError,
  parseLeadWithRelevanceAi,
} from "../../supabase/functions/_shared/relevance-ai";

describe("parseLeadWithRelevanceAi timeout handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("enforces configured timeout and throws a typed timeout error when no response is received", async () => {
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const parsePromise = parseLeadWithRelevanceAi(
      { lead_data: { name: "No Response Lead" } },
      "test-api-key",
      15_000,
    );
    const handledPromise = parsePromise.catch((value) => value);

    await vi.advanceTimersByTimeAsync(15_001);

    const error = await handledPromise;
    expect(error).toBeInstanceOf(RelevanceAiTimeoutError);
    expect(error).toMatchObject({ timeoutMs: 15_000 });
  });

  it("detects timeout errors for fallback routing", () => {
    expect(isRelevanceAiTimeoutError(new RelevanceAiTimeoutError(45_000))).toBe(true);
    expect(isRelevanceAiTimeoutError(new Error("other"))).toBe(false);
  });
});

describe("lead ingestion fallback payloads", () => {
  it("builds fallback insert payload to avoid lead loss when parsing returns no response", () => {
    const payload = buildFallbackLeadInsertValues({
      leadData: null,
      source: "facebook",
      rawPayload: { form_id: "form-1" },
      leadStatus: {
        status: "qualified",
        approved_at: "2026-04-04T10:00:00.000Z",
        qualified_at: "2026-04-04T10:00:00.000Z",
      },
      userId: "user-1",
      accountId: "account-1",
    });

    expect(payload).toMatchObject({
      name: "Needs Review",
      source: "facebook",
      created_by: "user-1",
      account_id: "account-1",
      status: "qualified",
    });
    expect(payload.notes).toContain("Could not fully parse lead data");
  });

  it("logs timeout fallback metadata for audit/monitoring", () => {
    const interaction = buildFallbackInteractionPayload({
      leadId: "lead-1",
      autoQualify: true,
      source: "facebook",
      directParsed: false,
      aiFallbackReason: "timeout",
    });

    expect(interaction.summary).toContain("Auto-Qualify endpoint timeout");
    expect(interaction.metadata).toMatchObject({
      source: "facebook",
      parsing_method: "timeout_fallback",
      ai_fallback_reason: "timeout",
      auto_qualify_endpoint_timeout: true,
    });
  });
});
