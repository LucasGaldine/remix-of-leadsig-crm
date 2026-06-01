import { supabase } from "@/integrations/supabase/client";
import type { DocumentTemplateMergeFields } from "@/lib/documentTemplates";

function toMergeFieldValue(value: unknown): string | number | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  }
  return undefined;
}

export function normalizeDocumentTemplateMergeFields(value: unknown): DocumentTemplateMergeFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const raw = value as Record<string, unknown>;
  const normalized: DocumentTemplateMergeFields = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = String(rawKey || "").trim().toLowerCase();
    if (!key) continue;
    const nextValue = toMergeFieldValue(rawValue);
    if (nextValue === undefined) continue;
    normalized[key] = nextValue;
  }

  return normalized;
}

export async function fetchDocumentTemplateMergeFields(params: {
  accountId: string;
  leadId: string;
  estimateId?: string | null;
  scopeOfWorkOverride?: string | null;
}): Promise<DocumentTemplateMergeFields> {
  const { accountId, leadId, estimateId = null, scopeOfWorkOverride = null } = params;

  const { data, error } = await supabase.rpc("resolve_document_template_merge_fields", {
    p_account_id: accountId,
    p_lead_id: leadId,
    p_estimate_id: estimateId,
    p_scope_of_work_override: scopeOfWorkOverride,
  });

  if (error) {
    throw error;
  }

  return normalizeDocumentTemplateMergeFields(data);
}
