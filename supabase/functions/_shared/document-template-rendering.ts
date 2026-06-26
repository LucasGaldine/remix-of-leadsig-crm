export type DocumentTemplateMergeFieldValue = string | number | null | undefined;
export type DocumentTemplateMergeFields = Record<string, DocumentTemplateMergeFieldValue>;

export const DOCUMENT_TEMPLATE_BUILT_IN_VARIABLE_KEYS = [
  "scope_of_work",
  "job_name",
  "job_address",
  "service_type",
  "client_name",
  "client_email",
  "client_phone",
  "company_name",
  "company_email",
  "company_phone",
  "estimate_total",
  "estimate_subtotal",
  "estimate_tax",
  "estimate_discount",
  "default_payment_schedule",
  "default_payment_deposit_percentage",
  "default_payment_midpoint_percentage",
  "default_payment_final_percentage",
  "current_date",
] as const;

export const DOCUMENT_TEMPLATE_TOKEN_PATTERN_SOURCE =
  String.raw`(?:\[\[\s*([a-z0-9_]+)\s*\]\]|\{\{\s*([a-z0-9_]+)\s*\}\})`;

const DOCUMENT_TEMPLATE_VARIABLE_KEY_SET = new Set<string>(DOCUMENT_TEMPLATE_BUILT_IN_VARIABLE_KEYS);
const DEFAULT_BUILT_IN_TEMPLATE_FALLBACK = "Not provided";

export function normalizeDocumentTemplateVariableKey(key: unknown) {
  return String(key || "").trim().toLowerCase();
}

export function hasDocumentTemplateMergeFieldValue(value: DocumentTemplateMergeFieldValue) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

export function resolveDocumentTemplateVariableFallbackValue(key: string) {
  const normalizedKey = normalizeDocumentTemplateVariableKey(key);
  if (!normalizedKey) return "";

  if (normalizedKey === "current_date") {
    return new Date().toISOString().slice(0, 10);
  }

  if (DOCUMENT_TEMPLATE_VARIABLE_KEY_SET.has(normalizedKey)) {
    return DEFAULT_BUILT_IN_TEMPLATE_FALLBACK;
  }

  return "";
}

function formatPhoneTemplateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}

function maybeFormatTemplateMergeFieldValue(key: string, value: string) {
  if (/(^|_)phone$/.test(key)) {
    return formatPhoneTemplateValue(value);
  }
  return value;
}

export function renderDocumentTemplate(
  templateBody: string,
  mergeFields?: DocumentTemplateMergeFields | null,
) {
  if (!templateBody) return "";

  const matcher = new RegExp(DOCUMENT_TEMPLATE_TOKEN_PATTERN_SOURCE, "gi");
  return templateBody.replace(matcher, (_fullMatch, rawSquareKey, rawCurlyKey) => {
    const rawKey = rawSquareKey || rawCurlyKey;
    const normalizedKey = normalizeDocumentTemplateVariableKey(rawKey);
    const rawValue = mergeFields?.[normalizedKey];
    if (rawValue === null || rawValue === undefined) {
      return resolveDocumentTemplateVariableFallbackValue(normalizedKey);
    }

    const next = maybeFormatTemplateMergeFieldValue(normalizedKey, String(rawValue).trim());
    if (next) return next;
    return resolveDocumentTemplateVariableFallbackValue(normalizedKey);
  });
}
