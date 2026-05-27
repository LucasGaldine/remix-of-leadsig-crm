export const DOCUMENT_EMAIL_TIMINGS = [
  "never",
  "on_estimate_approval",
  "on_job_completion",
  "manual",
] as const;

export type DocumentEmailTiming = (typeof DOCUMENT_EMAIL_TIMINGS)[number];
export type DocumentTemplateMergeFieldValue = string | number | null | undefined;
export type DocumentTemplateMergeFields = Record<string, DocumentTemplateMergeFieldValue>;

export type SystemDocumentTemplateKey = "job_agreement" | "warranty_agreement" | "job_release";

export interface DocumentTemplateDefinition {
  name: string;
  slug: string;
  system_key: SystemDocumentTemplateKey | null;
  body: string;
  default_included_in_jobs: boolean;
  default_email_timing: DocumentEmailTiming;
  default_requires_signature: boolean;
}

export interface DocumentTemplateRecord extends DocumentTemplateDefinition {
  id: string;
  account_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobDocumentConfigRecord {
  id: string;
  lead_id: string;
  account_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: DocumentEmailTiming;
  requires_signature: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  template?: DocumentTemplateRecord | null;
}

export interface DocumentTemplateVariableDefinition {
  key: string;
  label: string;
  description: string;
}

export const DEFAULT_JOB_AGREEMENT_TEMPLATE_BODY = `**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Service Type:** [[service_type]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
- **Subtotal:** [[estimate_subtotal]]
- **Tax:** [[estimate_tax]]
- **Discount:** [[estimate_discount]]
- **Total:** [[estimate_total]]

## Default Payment Schedule
- **Schedule:** [[default_payment_schedule]]
- **Deposit:** [[default_payment_deposit_percentage]]%
- **Midpoint:** [[default_payment_midpoint_percentage]]%
- **Final Payment:** [[default_payment_final_percentage]]%

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
`;

export const DEFAULT_WARRANTY_TEMPLATE_BODY = `**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Covered Scope
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
`;

export const DEFAULT_JOB_RELEASE_TEMPLATE_BODY = `**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Completed Scope
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
`;

export const DOCUMENT_TEMPLATE_VARIABLES: DocumentTemplateVariableDefinition[] = [
  {
    key: "scope_of_work",
    label: "Scope of Work",
    description: "Formatted scope text from estimate line items or job description.",
  },
  {
    key: "job_name",
    label: "Job Name",
    description: "Project/job title.",
  },
  {
    key: "job_address",
    label: "Job Address",
    description: "Combined job address and city.",
  },
  {
    key: "service_type",
    label: "Service Type",
    description: "Service type set on the job.",
  },
  {
    key: "client_name",
    label: "Client Name",
    description: "Customer/client full name.",
  },
  {
    key: "client_email",
    label: "Client Email",
    description: "Customer/client email.",
  },
  {
    key: "client_phone",
    label: "Client Phone",
    description: "Customer/client phone number.",
  },
  {
    key: "company_name",
    label: "Company Name",
    description: "Your company name.",
  },
  {
    key: "company_email",
    label: "Company Email",
    description: "Your company email.",
  },
  {
    key: "company_phone",
    label: "Company Phone",
    description: "Your company phone.",
  },
  {
    key: "estimate_total",
    label: "Estimate Total",
    description: "Total estimate amount.",
  },
  {
    key: "estimate_subtotal",
    label: "Estimate Subtotal",
    description: "Subtotal before tax/discount.",
  },
  {
    key: "estimate_tax",
    label: "Estimate Tax",
    description: "Estimated tax amount.",
  },
  {
    key: "estimate_discount",
    label: "Estimate Discount",
    description: "Estimated discount amount.",
  },
  {
    key: "default_payment_schedule",
    label: "Default Payment Schedule",
    description: "Formatted default payment schedule from account settings.",
  },
  {
    key: "default_payment_deposit_percentage",
    label: "Default Deposit %",
    description: "Default deposit percentage from account settings.",
  },
  {
    key: "default_payment_midpoint_percentage",
    label: "Default Midpoint %",
    description: "Default midpoint percentage from account settings.",
  },
  {
    key: "default_payment_final_percentage",
    label: "Default Final %",
    description: "Default final percentage from account settings.",
  },
  {
    key: "current_date",
    label: "Current Date",
    description: "Current date in YYYY-MM-DD format.",
  },
];

export const DEFAULT_DOCUMENT_TEMPLATE_DEFINITIONS: DocumentTemplateDefinition[] = [
  {
    name: "Job Agreement",
    slug: "job-agreement",
    system_key: "job_agreement",
    body: DEFAULT_JOB_AGREEMENT_TEMPLATE_BODY,
    default_included_in_jobs: true,
    default_email_timing: "on_estimate_approval",
    default_requires_signature: true,
  },
  {
    name: "Warranty",
    slug: "warranty",
    system_key: "warranty_agreement",
    body: DEFAULT_WARRANTY_TEMPLATE_BODY,
    default_included_in_jobs: true,
    default_email_timing: "on_estimate_approval",
    default_requires_signature: true,
  },
  {
    name: "Job Release",
    slug: "job-release",
    system_key: "job_release",
    body: DEFAULT_JOB_RELEASE_TEMPLATE_BODY,
    default_included_in_jobs: true,
    default_email_timing: "on_job_completion",
    default_requires_signature: true,
  },
];

export const DOCUMENT_EMAIL_TIMING_LABELS: Record<DocumentEmailTiming, string> = {
  never: "Never",
  on_estimate_approval: "On Estimate Approval",
  on_job_completion: "On Job Completion",
  manual: "Manual",
};

export function normalizeDocumentTemplateSlug(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "document";
}

export function formatDocumentTemplateToken(key: string) {
  return `[[${key}]]`;
}

const DOCUMENT_TEMPLATE_TOKEN_PATTERN = /(?:\[\[\s*([a-z0-9_]+)\s*\]\]|\{\{\s*([a-z0-9_]+)\s*\}\})/i;
const DOCUMENT_TEMPLATE_VARIABLE_KEY_SET = new Set(DOCUMENT_TEMPLATE_VARIABLES.map((variable) => variable.key));
const DEFAULT_BUILT_IN_TEMPLATE_FALLBACK = "Not provided";

function normalizeTemplateVariableKey(key: unknown) {
  return String(key || "").trim().toLowerCase();
}

function hasTemplateMergeFieldValue(value: DocumentTemplateMergeFieldValue) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

export function extractDocumentTemplateVariableKeys(templateBody: string) {
  const normalizedBody = String(templateBody || "");
  if (!normalizedBody.trim()) return [];

  const seen = new Set<string>();
  const keys: string[] = [];
  const matcher = new RegExp(DOCUMENT_TEMPLATE_TOKEN_PATTERN.source, "gi");
  let match = matcher.exec(normalizedBody);
  while (match) {
    const normalizedKey = normalizeTemplateVariableKey(match[1] || match[2]);
    if (normalizedKey && !seen.has(normalizedKey)) {
      seen.add(normalizedKey);
      keys.push(normalizedKey);
    }
    match = matcher.exec(normalizedBody);
  }

  return keys;
}

export function findMissingDocumentTemplateVariableKeys(
  templateBody: string,
  mergeFields?: DocumentTemplateMergeFields | null,
) {
  const variableKeys = extractDocumentTemplateVariableKeys(templateBody);
  return variableKeys.filter((key) => {
    if (hasTemplateMergeFieldValue(mergeFields?.[key])) return false;
    return resolveTemplateVariableFallbackValue(key).length === 0;
  });
}

function resolveTemplateVariableFallbackValue(key: string) {
  const normalizedKey = normalizeTemplateVariableKey(key);
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

export function renderDocumentTemplateText(
  templateBody: string,
  mergeFields?: DocumentTemplateMergeFields | null,
) {
  if (!templateBody) return "";

  const matcher = new RegExp(DOCUMENT_TEMPLATE_TOKEN_PATTERN.source, "gi");
  return templateBody.replace(matcher, (fullMatch, rawSquareKey, rawCurlyKey) => {
    const rawKey = rawSquareKey || rawCurlyKey;
    const normalizedKey = normalizeTemplateVariableKey(rawKey);
    const rawValue = mergeFields?.[normalizedKey];
    if (rawValue === null || rawValue === undefined) {
      return resolveTemplateVariableFallbackValue(normalizedKey);
    }

    const next = maybeFormatTemplateMergeFieldValue(normalizedKey, String(rawValue).trim());
    if (next) return next;
    return resolveTemplateVariableFallbackValue(normalizedKey);
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdownToHtml(value: string) {
  const escaped = escapeHtml(value);
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>',
  );
  const withCode = withLinks.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/(^|[^\*])\*([^*]+)\*($|[^\*])/g, "$1<em>$2</em>$3");
  return withItalic;
}

function isBulletLine(line: string) {
  return /^\s*[-*]\s*/.test(line);
}

function isOrderedLine(line: string) {
  return /^\s*\d+\.\s+/.test(line);
}

export function renderDocumentTemplateMarkdownHtml(value: string) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized.split("\n");
  const htmlBlocks: string[] = [];
  let pendingParagraph: string[] = [];
  let pendingBullets: string[] = [];
  let pendingOrdered: string[] = [];

  const flushParagraph = () => {
    if (pendingParagraph.length === 0) return;
    htmlBlocks.push(`<p>${pendingParagraph.map((line) => renderInlineMarkdownToHtml(line)).join("<br />")}</p>`);
    pendingParagraph = [];
  };

  const flushBullets = () => {
    if (pendingBullets.length === 0) return;
    const items = pendingBullets.map((line) => `<li>${renderInlineMarkdownToHtml(line)}</li>`).join("");
    htmlBlocks.push(`<ul>${items}</ul>`);
    pendingBullets = [];
  };

  const flushOrdered = () => {
    if (pendingOrdered.length === 0) return;
    const items = pendingOrdered.map((line) => `<li>${renderInlineMarkdownToHtml(line)}</li>`).join("");
    htmlBlocks.push(`<ol>${items}</ol>`);
    pendingOrdered = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushOrdered();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushAll();
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushAll();
      htmlBlocks.push(`<h3>${renderInlineMarkdownToHtml(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }

    if (/^##\s+/.test(line)) {
      flushAll();
      htmlBlocks.push(`<h2>${renderInlineMarkdownToHtml(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }

    if (/^#\s+/.test(line)) {
      flushAll();
      htmlBlocks.push(`<h1>${renderInlineMarkdownToHtml(line.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }

    if (isBulletLine(line)) {
      flushParagraph();
      flushOrdered();
      pendingBullets.push(line.replace(/^\s*[-*]\s*/, ""));
      continue;
    }

    if (isOrderedLine(line)) {
      flushParagraph();
      flushBullets();
      pendingOrdered.push(line.replace(/^\s*\d+\.\s+/, ""));
      continue;
    }

    flushBullets();
    flushOrdered();
    pendingParagraph.push(line);
  }

  flushAll();
  return htmlBlocks.join("\n");
}

export function documentTemplateMarkdownToPlainText(value: string) {
  const normalized = String(value || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return "";

  return normalized
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeScopeLine(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text;
}

export function buildScopeOfWorkValue(params: {
  lineItems?: Array<{
    name?: string | null;
    description?: string | null;
    quantity?: number | string | null;
    unit?: string | null;
  }> | null;
  fallbackDescription?: string | null;
}) {
  const lineItems = params.lineItems || [];
  const scopeLines = lineItems
    .map((lineItem, index) => {
      const name = normalizeScopeLine(lineItem?.name) || `Line Item ${index + 1}`;
      const description = normalizeScopeLine(lineItem?.description);
      const quantityRaw = Number(lineItem?.quantity);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? String(quantityRaw) : "";
      const unit = normalizeScopeLine(lineItem?.unit);
      const quantityLabel = quantity ? `${quantity}${unit ? ` ${unit}` : ""}` : "";
      const header = quantityLabel ? `${name} (${quantityLabel})` : name;
      return `${index + 1}. ${header}${description ? `: ${description}` : ""}`;
    })
    .filter(Boolean);

  if (scopeLines.length > 0) {
    return scopeLines.join("\n");
  }

  return normalizeScopeLine(params.fallbackDescription);
}

function readTemplateText(record: Record<string, unknown> | null | undefined, key: string) {
  if (!record) return "";
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getDocumentTemplateSourceText(params: {
  template:
    | {
        system_key: SystemDocumentTemplateKey | null;
        body?: string | null;
      }
    | null
    | undefined;
  estimateAgreementTemplates?: Record<string, unknown> | null;
  jobReleaseText?: string | null;
}) {
  const template = params.template;
  if (!template) return "";

  if (template.system_key === "job_agreement") {
    return (
      (template.body || "").trim()
      || readTemplateText(params.estimateAgreementTemplates, "job_agreement")
    );
  }

  if (template.system_key === "warranty_agreement") {
    return (
      (template.body || "").trim()
      || readTemplateText(params.estimateAgreementTemplates, "warranty_agreement")
    );
  }

  if (template.system_key === "job_release") {
    const releaseText = (params.jobReleaseText || "").trim();
    return (template.body || "").trim() || releaseText;
  }

  return (template.body || "").trim();
}

export function getDocumentFallbackText(params: {
  template:
    | {
        system_key: SystemDocumentTemplateKey | null;
        body?: string | null;
      }
    | null
    | undefined;
  estimateAgreementTemplates?: Record<string, unknown> | null;
  jobReleaseText?: string | null;
  templateMergeFields?: DocumentTemplateMergeFields | null;
}) {
  const raw = getDocumentTemplateSourceText({
    template: params.template,
    estimateAgreementTemplates: params.estimateAgreementTemplates,
    jobReleaseText: params.jobReleaseText,
  });
  return renderDocumentTemplateText(raw, params.templateMergeFields);
}
