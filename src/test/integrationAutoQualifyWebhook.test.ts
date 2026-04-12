import { afterEach, describe, expect, it, vi } from "vitest";

import {
  evaluateAutoQualifyWebhook,
  evaluateIntegrationQualificationDecision,
  getAutoQualifyWebhookConfig,
} from "../../supabase/functions/_shared/integration-lead-automation";

describe("integration auto-qualify webhook config", () => {
  it("returns null when webhook url is missing", () => {
    const config = getAutoQualifyWebhookConfig({ auto_qualify_integration_leads: true });
    expect(config).toBeNull();
  });

  it("returns normalized config when enabled with endpoint", () => {
    const config = getAutoQualifyWebhookConfig({
      auto_qualify_integration_leads: true,
      auto_qualify_webhook: {
        endpoint_url: "  https://hooks.example.com/qualify  ",
        auth_header_name: "  x-api-key ",
        auth_header_value: " secret ",
      },
    });

    expect(config).toEqual({
      endpointUrl: "https://hooks.example.com/qualify",
      authHeaderName: "x-api-key",
      authHeaderValue: " secret ",
    });
  });
});

describe("evaluateAutoQualifyWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks lead as qualified when endpoint returns qualified=true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ qualified: true, reason: "service fit" }),
      text: async () => "",
    }));

    const result = await evaluateAutoQualifyWebhook({
      config: {
        endpointUrl: "https://hooks.example.com/qualify",
        authHeaderName: "x-api-key",
        authHeaderValue: "secret",
      },
      accountId: "acct_1",
      source: "facebook",
      leadData: { full_name: "Jane Smith", email: "jane@example.com" },
      rawPayload: { form_id: "abc" },
    });

    expect(result.qualified).toBe(true);
    expect(result.reason).toBe("service fit");
    expect(result.metadata.response_status).toBe(200);
    expect(result.metadata.webhook_used).toBe(true);
  });

  it("marks lead as not qualified when endpoint returns status=not_qualified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "not_qualified" }),
      text: async () => "",
    }));

    const result = await evaluateAutoQualifyWebhook({
      config: {
        endpointUrl: "https://hooks.example.com/qualify",
      },
      accountId: "acct_1",
      source: "google",
      leadData: { full_name: "John Smith" },
      rawPayload: { lead_id: "lead_1" },
    });

    expect(result.qualified).toBe(false);
    expect(result.metadata.webhook_used).toBe(true);
  });

  it("falls back to default qualification when endpoint errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
      text: async () => "boom",
    }));

    const result = await evaluateAutoQualifyWebhook({
      config: {
        endpointUrl: "https://hooks.example.com/qualify",
      },
      accountId: "acct_1",
      source: "google",
      leadData: { full_name: "John Smith" },
      rawPayload: { lead_id: "lead_1" },
    });

    expect(result.qualified).toBe(true);
    expect(result.reason).toContain("fallback");
    expect(result.metadata.webhook_error).toBeDefined();
  });
});

describe("evaluateIntegrationQualificationDecision", () => {
  it("rejects as out of range when rule is enabled and lead location does not match", async () => {
    const result = await evaluateIntegrationQualificationDecision({
      automationSettings: {
        autoQualifyEnabled: true,
        webhookConfig: null,
        rejectOutOfRange: true,
        rejectOutOfBudget: false,
        minJobSize: {},
        serviceAreas: [
          {
            location: "Austin, TX",
            radiusMiles: 10,
            lat: 30.2672,
            lng: -97.7431,
          },
        ],
      },
      accountId: "acct_1",
      source: "google",
      leadData: {
        city: "Dallas",
        state: "TX",
        lat: 32.7767,
        lng: -96.797,
      },
      rawPayload: {},
    });

    expect(result.qualified).toBe(false);
    expect(result.metadata.rejection_rule).toBe("out_of_range");
  });

  it("rejects as out of budget when rule is enabled and budget is below min job size", async () => {
    const result = await evaluateIntegrationQualificationDecision({
      automationSettings: {
        autoQualifyEnabled: true,
        webhookConfig: null,
        rejectOutOfRange: false,
        rejectOutOfBudget: true,
        minJobSize: { "Pavers / Patio": 5000 },
        serviceAreas: [],
      },
      accountId: "acct_1",
      source: "google",
      leadData: {
        service_type: "Pavers / Patio",
        budget: 1200,
      },
      rawPayload: {},
    });

    expect(result.qualified).toBe(false);
    expect(result.metadata.rejection_rule).toBe("out_of_budget");
  });
});
