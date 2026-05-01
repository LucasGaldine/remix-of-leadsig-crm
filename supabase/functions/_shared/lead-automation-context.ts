type AccountSettings = {
  min_job_size?: Record<string, unknown> | null;
  service_areas?: Array<{
    location?: string;
    radius_miles?: number;
  }> | null;
};

type PricingRuleRow = {
  service_type?: string | null;
};

type QualificationDecision = {
  qualified: boolean | null;
  reason?: string;
};

function toTitleCaseService(serviceType: string): string {
  return serviceType
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeDecision(record: Record<string, unknown>): QualificationDecision {
  if (typeof record.qualified === "boolean") {
    return { qualified: record.qualified, reason: typeof record.reason === "string" ? record.reason : undefined };
  }
  if (typeof record.is_qualified === "boolean") {
    return { qualified: record.is_qualified, reason: typeof record.reason === "string" ? record.reason : undefined };
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
    return { qualified: true, reason: typeof record.reason === "string" ? record.reason : undefined };
  }
  if (notQualifiedStatuses.has(normalizedStatus)) {
    return { qualified: false, reason: typeof record.reason === "string" ? record.reason : undefined };
  }
  return { qualified: null };
}

function tryParseDecisionFromText(content: string): QualificationDecision {
  const trimmed = content.trim();
  if (!trimmed) return { qualified: null };

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return normalizeDecision(parsed as Record<string, unknown>);
      }
    } catch {
      // no-op
    }
  }

  const lower = trimmed.toLowerCase();
  if (/(^|\W)qualified\s*:\s*true(\W|$)/i.test(trimmed)) return { qualified: true };
  if (/(^|\W)qualified\s*:\s*false(\W|$)/i.test(trimmed)) return { qualified: false };
  if (lower.includes("not qualified")) return { qualified: false };
  if (lower.includes("qualified")) return { qualified: true };
  return { qualified: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractDecisionFromPostChatData(responseBody: unknown): QualificationDecision {
  if (!isRecord(responseBody)) return { qualified: null };

  const candidateNodes: unknown[] = [
    responseBody.post_chat_data,
    responseBody.post_chat_data_extraction,
    responseBody.extracted_data,
    responseBody.data_extraction,
    responseBody.metadata,
  ];

  if (Array.isArray(responseBody.variables)) {
    candidateNodes.push(...responseBody.variables);
  }

  for (const node of candidateNodes) {
    if (isRecord(node)) {
      const decision = normalizeDecision(node);
      if (decision.qualified !== null) return decision;
    }
  }

  return { qualified: null };
}

export async function buildLeadAutomationDynamicVars(params: {
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>;
  accountId: string;
  firstName: string;
  companyName: string;
  accountSettings?: unknown;
}): Promise<Record<string, string>> {
  const settings = (params.accountSettings ?? {}) as AccountSettings;

  const minJobSizeRecord = (
    settings.min_job_size &&
      typeof settings.min_job_size === "object" &&
      !Array.isArray(settings.min_job_size)
      ? settings.min_job_size
      : {}
  ) as Record<string, unknown>;

  const minJobSize = Object.fromEntries(
    Object.entries(minJobSizeRecord)
      .filter(([key, value]) => typeof key === "string" && typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => [key, Math.max(0, value as number)]),
  ) as Record<string, number>;

  const serviceAreas = Array.isArray(settings.service_areas)
    ? settings.service_areas
      .map((serviceArea) => {
        const location = typeof serviceArea?.location === "string" ? serviceArea.location.trim() : "";
        const radiusMiles = typeof serviceArea?.radius_miles === "number" && Number.isFinite(serviceArea.radius_miles)
          ? Math.max(0, serviceArea.radius_miles)
          : 0;
        return { location, radiusMiles };
      })
      .filter((serviceArea) => serviceArea.location.length > 0)
    : [];

  const { data: pricingRules } = await params.supabase
    .from("pricing_rules")
    .select("service_type")
    .eq("account_id", params.accountId);

  const services = Array.from(new Set(
    ((pricingRules ?? []) as PricingRuleRow[])
      .map((rule) => (typeof rule.service_type === "string" ? rule.service_type.trim() : ""))
      .filter((serviceType) => serviceType.length > 0),
  ));

  const serviceAreasText = serviceAreas.length > 0
    ? serviceAreas.map((area) => `${area.location} (${area.radiusMiles} mi)`).join("; ")
    : "Not specified";

  const serviceListText = services.length > 0
    ? services.map(toTitleCaseService).join(", ")
    : "Not specified";

  const servicesWithMinimumsText = services.length > 0
    ? services
      .map((serviceType) => {
        const label = toTitleCaseService(serviceType);
        const minimum = minJobSize[serviceType] ?? 0;
        return `${label}: $${minimum.toFixed(2)} minimum`;
      })
      .join("; ")
    : "Not specified";

  return {
    "contact.first_name": params.firstName,
    "company name": params.companyName,
    "companies name": params.companyName,
    company: params.companyName,
    contact_first_name: params.firstName,
    first_name: params.firstName,
    company_name: params.companyName,
    companies_name: params.companyName,
    service_areas: serviceAreasText,
    company_service_areas: serviceAreasText,
    services: serviceListText,
    company_services: serviceListText,
    services_with_minimums: servicesWithMinimumsText,
    company_services_with_minimums: servicesWithMinimumsText,
  };
}

export function extractQualificationDecisionFromRetellResponse(responseBody: unknown): QualificationDecision {
  const postChatDecision = extractDecisionFromPostChatData(responseBody);
  if (postChatDecision.qualified !== null) return postChatDecision;

  const messages = Array.isArray((responseBody as Record<string, unknown> | null)?.messages)
    ? (responseBody as { messages: Array<{ content?: unknown }> }).messages
    : [];

  for (const message of messages) {
    if (typeof message?.content !== "string") continue;
    const decision = tryParseDecisionFromText(message.content);
    if (decision.qualified !== null) return decision;
  }

  return { qualified: null };
}
