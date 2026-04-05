export type IntegrationLeadStatusPatch = {
  status: "qualified" | "new";
  approval_status: "approved" | "pending";
  approved_at: string | null;
  submitted_at: string;
};

export type AutoQualifyWebhookConfig = {
  endpointUrl: string;
  authHeaderName?: string;
  authHeaderValue?: string;
};

type AccountSettings = {
  auto_qualify_integration_leads?: boolean;
  auto_qualify_webhook?: {
    endpoint_url?: string;
    auth_header_name?: string;
    auth_header_value?: string;
  };
};

const DEFAULT_WEBHOOK_TIMEOUT_MS = 12_000;
const MIN_WEBHOOK_TIMEOUT_MS = 3_000;
const MAX_WEBHOOK_TIMEOUT_MS = 60_000;

function clampTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_WEBHOOK_TIMEOUT_MS;
  const rounded = Math.floor(timeoutMs);
  if (rounded < MIN_WEBHOOK_TIMEOUT_MS) return MIN_WEBHOOK_TIMEOUT_MS;
  if (rounded > MAX_WEBHOOK_TIMEOUT_MS) return MAX_WEBHOOK_TIMEOUT_MS;
  return rounded;
}

function resolveWebhookTimeoutMs(): number {
  const denoGlobal = globalThis as { Deno?: { env?: { get: (name: string) => string | undefined } } };
  const configured = denoGlobal.Deno?.env?.get("AUTO_QUALIFY_WEBHOOK_TIMEOUT_MS");
  if (!configured) return DEFAULT_WEBHOOK_TIMEOUT_MS;

  const parsed = Number.parseInt(configured, 10);
  return clampTimeout(parsed);
}

function normalizeResponseDecision(responsePayload: unknown): { qualified: boolean | null; reason?: string } {
  if (typeof responsePayload === "boolean") {
    return { qualified: responsePayload };
  }

  if (!responsePayload || typeof responsePayload !== "object") {
    return { qualified: null };
  }

  const record = responsePayload as Record<string, unknown>;

  if (typeof record.qualified === "boolean") {
    return {
      qualified: record.qualified,
      reason: typeof record.reason === "string" ? record.reason : undefined,
    };
  }

  if (typeof record.is_qualified === "boolean") {
    return {
      qualified: record.is_qualified,
      reason: typeof record.reason === "string" ? record.reason : undefined,
    };
  }

  const normalizedStatus = typeof record.status === "string"
    ? record.status.trim().toLowerCase()
    : "";

  const qualifiedStatuses = new Set(["qualified", "approve", "approved", "pass", "passed", "yes", "true"]);
  const notQualifiedStatuses = new Set([
    "not_qualified",
    "not-qualified",
    "unqualified",
    "disqualify",
    "disqualified",
    "reject",
    "rejected",
    "no",
    "false",
  ]);

  if (qualifiedStatuses.has(normalizedStatus)) {
    return {
      qualified: true,
      reason: typeof record.reason === "string" ? record.reason : undefined,
    };
  }

  if (notQualifiedStatuses.has(normalizedStatus)) {
    return {
      qualified: false,
      reason: typeof record.reason === "string" ? record.reason : undefined,
    };
  }

  return { qualified: null };
}

export function buildIntegrationLeadStatus(qualified: boolean, now = new Date().toISOString()): IntegrationLeadStatusPatch {
  if (qualified) {
    return {
      status: "qualified",
      approval_status: "approved",
      approved_at: now,
      submitted_at: now,
    };
  }

  return {
    status: "new",
    approval_status: "pending",
    approved_at: null,
    submitted_at: now,
  };
}

export function getAutoQualifyWebhookConfig(settings: AccountSettings | null): AutoQualifyWebhookConfig | null {
  if (!settings?.auto_qualify_integration_leads) return null;

  const endpointUrl = settings.auto_qualify_webhook?.endpoint_url?.trim();
  if (!endpointUrl) return null;

  return {
    endpointUrl,
    authHeaderName: settings.auto_qualify_webhook?.auth_header_name?.trim() || undefined,
    authHeaderValue: settings.auto_qualify_webhook?.auth_header_value,
  };
}

export async function getIntegrationAutomationSettings(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  accountId: string,
): Promise<{ autoQualifyEnabled: boolean; webhookConfig: AutoQualifyWebhookConfig | null }> {
  const { data, error } = await supabase
    .from("accounts")
    .select("settings")
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    console.error("integration-lead-automation: failed to load account settings", error);
    return { autoQualifyEnabled: false, webhookConfig: null };
  }

  const settings = (data?.settings ?? null) as AccountSettings | null;
  const autoQualifyEnabled = settings?.auto_qualify_integration_leads === true;

  return {
    autoQualifyEnabled,
    webhookConfig: getAutoQualifyWebhookConfig(settings),
  };
}

export async function isIntegrationAutoQualifyEnabled(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  accountId: string,
): Promise<boolean> {
  const settings = await getIntegrationAutomationSettings(supabase, accountId);
  return settings.autoQualifyEnabled;
}

export async function evaluateAutoQualifyWebhook(params: {
  config: AutoQualifyWebhookConfig;
  accountId: string;
  source: string;
  leadData: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}): Promise<{
  qualified: boolean;
  reason: string;
  metadata: Record<string, unknown>;
}> {
  const { config, accountId, source, leadData, rawPayload } = params;
  const timeoutMs = resolveWebhookTimeoutMs();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.authHeaderName && config.authHeaderValue) {
      headers[config.authHeaderName] = config.authHeaderValue;
    }

    const response = await fetch(config.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "auto_qualify_lead",
        account_id: accountId,
        source,
        timestamp: new Date().toISOString(),
        lead: leadData,
        raw_payload: rawPayload,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responsePayload: unknown = null;
    try {
      responsePayload = await response.json();
    } catch {
      responsePayload = null;
    }

    if (!response.ok) {
      const fallbackText = responsePayload ? JSON.stringify(responsePayload) : await response.text();
      throw new Error(`endpoint returned ${response.status}: ${fallbackText}`);
    }

    const decision = normalizeResponseDecision(responsePayload);
    if (decision.qualified === null) {
      console.warn("integration-lead-automation: webhook returned unrecognized qualification payload", {
        accountId,
        source,
        endpointUrl: config.endpointUrl,
      });

      return {
        qualified: true,
        reason: "Auto-qualify webhook response invalid; fallback to qualified",
        metadata: {
          webhook_used: true,
          endpoint_url: config.endpointUrl,
          response_status: response.status,
          response_valid: false,
        },
      };
    }

    return {
      qualified: decision.qualified,
      reason: decision.reason || (decision.qualified ? "Qualified by endpoint" : "Not qualified by endpoint"),
      metadata: {
        webhook_used: true,
        endpoint_url: config.endpointUrl,
        response_status: response.status,
        response_valid: true,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : String(error);

    console.error("integration-lead-automation: webhook evaluation failed", {
      accountId,
      source,
      endpointUrl: config.endpointUrl,
      timeoutMs,
      error: message,
    });

    return {
      qualified: true,
      reason: isAbort
        ? `Auto-qualify webhook timeout after ${timeoutMs}ms; fallback to qualified`
        : `Auto-qualify webhook error; fallback to qualified`,
      metadata: {
        webhook_used: true,
        endpoint_url: config.endpointUrl,
        response_valid: false,
        timeout_ms: timeoutMs,
        webhook_error: message,
        webhook_timeout: isAbort,
      },
    };
  }
}
