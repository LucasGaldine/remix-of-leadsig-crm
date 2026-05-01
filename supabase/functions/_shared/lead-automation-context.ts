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
  address?: string;
  city?: string;
  description?: string;
  budget?: number;
};

function toTitleCaseService(serviceType: string): string {
  return serviceType
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeDecision(record: Record<string, unknown>): QualificationDecision {
  const address = firstNonEmptyString([
    record.address,
    record.lead_address,
    record.leadAddress,
    record.street_address,
    record.streetAddress,
    findDeepValue(record, ["address", "lead_address", "leadAddress", "street_address", "streetAddress"]),
  ]);
  const city = firstNonEmptyString([record.city, findDeepValue(record, ["city"])]);
  const description = firstNonEmptyString([
    record.description,
    record.project_description,
    record.projectDescription,
    record.project_details,
    record.projectDetails,
    findDeepValue(record, [
      "description",
      "project_description",
      "projectDescription",
      "project_details",
      "projectDetails",
    ]),
  ]);
  const budget = firstFiniteNumber([
    record.budget,
    record.estimated_value,
    record.estimatedValue,
    record.project_budget,
    record.projectBudget,
    findDeepValue(record, ["budget", "estimated_value", "estimatedValue", "project_budget", "projectBudget"]),
  ]);

  if (typeof record.qualified === "boolean") {
    return {
      qualified: record.qualified,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(description ? { description } : {}),
      ...(budget !== null ? { budget } : {}),
    };
  }
  if (typeof record.is_qualified === "boolean") {
    return {
      qualified: record.is_qualified,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(description ? { description } : {}),
      ...(budget !== null ? { budget } : {}),
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
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(description ? { description } : {}),
      ...(budget !== null ? { budget } : {}),
    };
  }
  if (notQualifiedStatuses.has(normalizedStatus)) {
    return {
      qualified: false,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(description ? { description } : {}),
      ...(budget !== null ? { budget } : {}),
    };
  }
  return {
    qualified: null,
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(description ? { description } : {}),
    ...(budget !== null ? { budget } : {}),
  };
}

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseBudget(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstFiniteNumber(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = parseBudget(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // no-op
    }
  }
  return {};
}

function findDeepValue(obj: unknown, keys: string[], maxDepth = 6): unknown {
  const targets = new Set(keys.map((k) => k.toLowerCase()));
  const visited = new Set<unknown>();

  function walk(value: unknown, depth: number): unknown {
    if (depth > maxDepth || value === null || value === undefined) return undefined;
    if (typeof value === "string") {
      const parsed = parseJsonObject(value);
      if (Object.keys(parsed).length > 0) return walk(parsed, depth + 1);
      return undefined;
    }
    if (typeof value !== "object") return undefined;
    if (visited.has(value)) return undefined;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      if (targets.has(k.toLowerCase()) && v !== undefined && v !== null) return v;
    }
    for (const v of Object.values(record)) {
      const found = walk(v, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  return walk(obj, 0);
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

  const messages = Array.isArray((responseBody as Record<string, unknown> | null)?.messages)
    ? (responseBody as { messages: Array<{ content?: unknown }> }).messages
    : [];

  let messageDecision: QualificationDecision = { qualified: null };
  for (const message of messages) {
    if (typeof message?.content !== "string") continue;
    const decision = tryParseDecisionFromText(message.content);
    if (decision.qualified !== null) {
      messageDecision = decision;
      break;
    }
  }

  return {
    qualified: postChatDecision.qualified ?? messageDecision.qualified,
    reason: postChatDecision.reason ?? messageDecision.reason,
    ...(postChatDecision.address ? { address: postChatDecision.address } : {}),
    ...(postChatDecision.city ? { city: postChatDecision.city } : {}),
    ...(postChatDecision.description ? { description: postChatDecision.description } : {}),
    ...(postChatDecision.budget !== undefined ? { budget: postChatDecision.budget } : {}),
  };
}
