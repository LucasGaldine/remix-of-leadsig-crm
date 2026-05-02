export function hasAgreementTemplateText(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.values(record).some((entry) => {
    if (typeof entry === "string") return entry.trim().length > 0;
    if (!entry || typeof entry !== "object") return false;
    const nested = entry as Record<string, unknown>;
    return (
      (typeof nested.text === "string" && nested.text.trim().length > 0) ||
      (typeof nested.content === "string" && nested.content.trim().length > 0) ||
      (typeof nested.body === "string" && nested.body.trim().length > 0)
    );
  });
}

export function getAgreementTemplatesCandidate(estimate: any): unknown[] {
  if (!estimate || typeof estimate !== "object") return [];
  const record = estimate as Record<string, unknown>;
  const proposalSettings =
    record.proposal_settings && typeof record.proposal_settings === "object"
      ? (record.proposal_settings as Record<string, unknown>)
      : null;

  return [
    record.agreement_templates,
    proposalSettings?.agreement_templates,
    proposalSettings?.agreementTemplates,
  ];
}

export function resolveAgreementTemplates(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return hasAgreementTemplateText(value) ? (value as Record<string, unknown>) : null;
}

export function resolveAgreementTemplatesFromEstimate(estimate: any): Record<string, unknown> | null {
  const candidates = getAgreementTemplatesCandidate(estimate);
  for (const candidate of candidates) {
    const resolved = resolveAgreementTemplates(candidate);
    if (resolved) return resolved;
  }
  return null;
}

export function resolveAgreementTemplatesForEstimates(estimates: any[]): {
  templates: Record<string, unknown> | null;
  sourceEstimateId: string | null;
} {
  const requiredKeys = ["job_release_agreement", "job_agreement", "warranty_agreement"] as const;
  const valid = estimates.filter((item) => item && typeof item === "object");
  const merged: Record<string, unknown> = {};
  let sourceEstimateId: string | null = null;
  const genericPhrases = [
    "by approving this estimate",
    "authorize release of work",
    "agreed scope",
  ];
  const extractText = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.text === "string") return record.text.trim();
      if (typeof record.content === "string") return record.content.trim();
      if (typeof record.body === "string") return record.body.trim();
    }
    return "";
  };
  const scoreText = (text: string): number => {
    if (!text) return -1;
    const normalized = text.toLowerCase();
    const isGeneric = genericPhrases.some((phrase) => normalized.includes(phrase));
    return isGeneric ? Math.min(text.length, 120) : text.length + 1000;
  };

  for (const key of requiredKeys) {
    let bestValue: unknown = null;
    let bestEstimateId: string | null = null;
    let bestScore = -1;
    for (const estimate of valid) {
      const resolved = resolveAgreementTemplatesFromEstimate(estimate);
      if (!resolved) continue;
      const value = resolved[key];
      const text = extractText(value);
      if (!text) continue;
      const score = scoreText(text);
      if (score > bestScore) {
        bestScore = score;
        bestValue = value;
        bestEstimateId = typeof estimate.id === "string" ? estimate.id : null;
      }
    }
    if (bestValue !== null) {
      merged[key] = bestValue;
      if (!sourceEstimateId && bestEstimateId) {
        sourceEstimateId = bestEstimateId;
      }
    }
  }

  if (Object.keys(merged).length > 0) {
    return { templates: merged, sourceEstimateId };
  }

  for (const estimate of valid) {
    const resolved = resolveAgreementTemplatesFromEstimate(estimate);
    if (resolved) {
      return {
        templates: resolved,
        sourceEstimateId: typeof estimate.id === "string" ? estimate.id : null,
      };
    }
  }

  return { templates: null, sourceEstimateId: null };
}
