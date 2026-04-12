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

export type IntegrationAutomationSettings = {
  autoQualifyEnabled: boolean;
  webhookConfig: AutoQualifyWebhookConfig | null;
  rejectOutOfRange: boolean;
  rejectOutOfBudget: boolean;
  minJobSize: Record<string, number>;
  serviceAreas: Array<{
    location: string;
    radiusMiles: number;
    lat: number | null;
    lng: number | null;
  }>;
};

type AccountSettings = {
  auto_qualify_integration_leads?: boolean;
  auto_qualify_reject_out_of_range?: boolean;
  auto_qualify_reject_out_of_budget?: boolean;
  auto_qualify_webhook?: {
    endpoint_url?: string;
    auth_header_name?: string;
    auth_header_value?: string;
  };
  min_job_size?: Record<string, number>;
  service_areas?: Array<{
    location?: string;
    radius_miles?: number;
    lat?: number | null;
    lng?: number | null;
  }>;
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
): Promise<IntegrationAutomationSettings> {
  const { data, error } = await supabase
    .from("accounts")
    .select("settings")
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    console.error("integration-lead-automation: failed to load account settings", error);
    return {
      autoQualifyEnabled: false,
      webhookConfig: null,
      rejectOutOfRange: false,
      rejectOutOfBudget: false,
      minJobSize: {},
      serviceAreas: [],
    };
  }

  const settings = (data?.settings ?? null) as AccountSettings | null;
  const autoQualifyEnabled = settings?.auto_qualify_integration_leads === true;
  const rejectOutOfRange = settings?.auto_qualify_reject_out_of_range === true;
  const rejectOutOfBudget = settings?.auto_qualify_reject_out_of_budget === true;

  const minJobSize = Object.fromEntries(
    Object.entries(settings?.min_job_size ?? {})
      .filter(([key, value]) => typeof key === "string" && typeof value === "number" && Number.isFinite(value)),
  );

  const serviceAreas = Array.isArray(settings?.service_areas)
    ? settings.service_areas
      .map((serviceArea) => {
        const location = typeof serviceArea?.location === "string" ? serviceArea.location.trim() : "";
        const radiusMiles = isFiniteNumber(serviceArea?.radius_miles) ? Math.max(0, serviceArea.radius_miles) : 0;
        const coordinates = toCoordinates(serviceArea?.lat, serviceArea?.lng);
        return {
          location,
          radiusMiles,
          lat: coordinates?.lat ?? null,
          lng: coordinates?.lng ?? null,
        };
      })
      .filter((serviceArea) =>
        serviceArea.radiusMiles > 0 &&
        (serviceArea.location.length > 0 || (serviceArea.lat !== null && serviceArea.lng !== null))
      )
    : [];

  return {
    autoQualifyEnabled,
    webhookConfig: getAutoQualifyWebhookConfig(settings),
    rejectOutOfRange,
    rejectOutOfBudget,
    minJobSize,
    serviceAreas,
  };
}

export async function isIntegrationAutoQualifyEnabled(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  accountId: string,
): Promise<boolean> {
  const settings = await getIntegrationAutomationSettings(supabase, accountId);
  return settings.autoQualifyEnabled;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type Coordinates = { lat: number; lng: number };

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  return { lat, lng };
}

function toLocationText(leadData: Record<string, unknown>): string {
  const leadCity = typeof leadData.city === "string" ? leadData.city.trim() : "";
  const leadState = typeof leadData.state === "string" ? leadData.state.trim() : "";
  const leadAddress = typeof leadData.address === "string" ? leadData.address.trim() : "";
  return [leadAddress, leadCity, leadState].filter(Boolean).join(", ");
}

function haversineMiles(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const arc = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const centralAngle = 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));

  return earthRadiusMiles * centralAngle;
}

const geocodeCache = new Map<string, Promise<Coordinates | null>>();

async function geocodeLocation(location: string): Promise<Coordinates | null> {
  const trimmedLocation = location.trim();
  if (!trimmedLocation) return null;

  const cacheKey = normalizeText(trimmedLocation);
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const geocodePromise = (async () => {
    const denoGlobal = globalThis as { Deno?: { env?: { get: (name: string) => string | undefined } } };
    const mapsApiKey = denoGlobal.Deno?.env?.get("GOOGLE_MAPS_API_KEY");
    if (!mapsApiKey) return null;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${
          encodeURIComponent(trimmedLocation)
        }&key=${encodeURIComponent(mapsApiKey)}`,
      );
      if (!response.ok) return null;

      const payload = await response.json() as {
        status?: string;
        results?: Array<{
          geometry?: {
            location?: {
              lat?: number;
              lng?: number;
            };
          };
        }>;
      };
      if (payload.status !== "OK") return null;

      const locationResult = payload.results?.[0]?.geometry?.location;
      return toCoordinates(locationResult?.lat, locationResult?.lng);
    } catch {
      return null;
    }
  })();

  geocodeCache.set(cacheKey, geocodePromise);
  return geocodePromise;
}

function findMinBudgetForServiceType(minJobSize: Record<string, number>, serviceType: string): number | null {
  const normalizedServiceType = normalizeText(serviceType);
  if (!normalizedServiceType) return null;

  const exactEntry = Object.entries(minJobSize).find(([key]) => normalizeText(key) === normalizedServiceType);
  if (exactEntry) return exactEntry[1];

  const partialEntry = Object.entries(minJobSize).find(([key]) => {
    const normalizedKey = normalizeText(key);
    return normalizedServiceType.includes(normalizedKey) || normalizedKey.includes(normalizedServiceType);
  });
  return partialEntry ? partialEntry[1] : null;
}

async function evaluateRuleBasedRejection(
  automationSettings: IntegrationAutomationSettings,
  leadData: Record<string, unknown>,
): Promise<{ qualified: false; reason: string; metadata: Record<string, unknown> } | null> {
  const leadServiceType = typeof leadData.service_type === "string" ? leadData.service_type.trim() : "";
  const leadBudget = typeof leadData.budget === "number" && Number.isFinite(leadData.budget) ? leadData.budget : null;

  if (automationSettings.rejectOutOfRange && automationSettings.serviceAreas.length > 0) {
    const leadLocation = toLocationText(leadData);
    const leadCoordinates = toCoordinates(leadData.lat, leadData.lng) ?? await geocodeLocation(leadLocation);

    if (leadCoordinates) {
      let inRange = false;
      for (const serviceArea of automationSettings.serviceAreas) {
        const serviceAreaCoordinates = toCoordinates(serviceArea.lat, serviceArea.lng) ?? await geocodeLocation(serviceArea.location);
        if (!serviceAreaCoordinates) continue;

        const distanceMiles = haversineMiles(leadCoordinates, serviceAreaCoordinates);
        if (distanceMiles <= serviceArea.radiusMiles) {
          inRange = true;
          break;
        }
      }

      if (!inRange) {
        return {
          qualified: false,
          reason: "Rejected: lead location appears outside configured service area radius",
          metadata: {
            rejection_rule: "out_of_range",
            lead_location: leadLocation,
            lead_coordinates: leadCoordinates,
            configured_service_areas: automationSettings.serviceAreas,
          },
        };
      }
    }
  }

  if (automationSettings.rejectOutOfBudget && leadBudget !== null && leadServiceType) {
    const minBudgetForServiceType = findMinBudgetForServiceType(automationSettings.minJobSize, leadServiceType);
    if (minBudgetForServiceType !== null && leadBudget < minBudgetForServiceType) {
      return {
        qualified: false,
        reason: `Rejected: lead budget ${leadBudget} is below minimum ${minBudgetForServiceType} for ${leadServiceType}`,
        metadata: {
          rejection_rule: "out_of_budget",
          lead_budget: leadBudget,
          min_budget: minBudgetForServiceType,
          service_type: leadServiceType,
        },
      };
    }
  }

  return null;
}

export async function evaluateIntegrationQualificationDecision(params: {
  automationSettings: IntegrationAutomationSettings;
  accountId: string;
  source: string;
  leadData: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}): Promise<{
  qualified: boolean;
  reason: string;
  metadata: Record<string, unknown>;
}> {
  const { automationSettings, accountId, source, leadData, rawPayload } = params;

  if (!automationSettings.autoQualifyEnabled) {
    return {
      qualified: false,
      reason: "Auto-qualify disabled",
      metadata: { webhook_used: false },
    };
  }

  const ruleBasedRejection = await evaluateRuleBasedRejection(automationSettings, leadData);
  if (ruleBasedRejection) return ruleBasedRejection;

  if (automationSettings.webhookConfig) {
    return evaluateAutoQualifyWebhook({
      config: automationSettings.webhookConfig,
      accountId,
      source,
      leadData,
      rawPayload,
    });
  }

  return {
    qualified: true,
    reason: "Auto-qualify enabled",
    metadata: { webhook_used: false },
  };
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
