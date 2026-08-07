import {
  buildSignedTemplatePdf,
  normalizeText,
  renderTemplate,
} from "../_shared/signed-copy.ts";

const LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY: Record<string, string> = {
  job_agreement: "job_agreement",
  warranty_agreement: "warranty",
  job_release: "job_release",
};

export type SignedDocumentTarget = {
  config: any;
  uploadedDocument?: any | null;
  bodyOverride?: string | null;
};

export type PersistedSignedDocument = {
  name: string;
  url: string;
};

export type SignedDocumentAttachment = {
  filename: string;
  content: Uint8Array;
  contentType?: string;
};

export function resolveUploadedDocumentForConfig(config: any, allConfigs: any[], allDocuments: any[]) {
  const configId = String(config?.id || "");
  if (configId) {
    const byConfig = allDocuments.find((doc: any) => String(doc?.config_id || "") === configId);
    if (byConfig) return byConfig;

    const byDocumentKeyConfigSuffix = allDocuments.find((doc: any) =>
      String(doc?.document_key || "").endsWith(`_${configId}`),
    );
    if (byDocumentKeyConfigSuffix) return byDocumentKeyConfigSuffix;
  }

  const templateId = String(config?.template?.id || config?.template_id || "");
  if (templateId) {
    const duplicateCount = allConfigs.filter((row: any) => String(row?.template_id || "") === templateId).length;
    if (duplicateCount <= 1) {
      const byTemplate = allDocuments.find((doc: any) => String(doc?.template_id || "") === templateId);
      if (byTemplate) return byTemplate;
    }
  }

  const systemKey = String(config?.template?.system_key || "");
  const legacyKey = systemKey ? LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY[systemKey] : "";
  if (legacyKey) {
    return allDocuments.find((doc: any) => String(doc?.document_key || "") === legacyKey) || null;
  }

  return null;
}

export function resolveTemplateBody(
  template: { system_key?: string | null; body?: string | null } | null | undefined,
  bodyOverride?: string | null,
) {
  const override = normalizeText(bodyOverride);
  if (override) return override;

  const body = normalizeText(template?.body);
  if (body) return body;

  return "";
}

export function toMergeFieldsRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeText(rawKey).toLowerCase();
    if (!key) continue;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      next[key] = String(rawValue);
      continue;
    }
    const text = normalizeText(rawValue);
    if (!text && rawValue !== "") continue;
    next[key] = text;
  }
  return next;
}

export async function resolveDocumentTemplateMergeFields(params: {
  supabase: any;
  accountId: string;
  leadId: string;
  estimateId?: string | null;
  scopeOfWorkOverride?: string | null;
}): Promise<Record<string, string>> {
  const { supabase, accountId, leadId, estimateId = null, scopeOfWorkOverride = null } = params;
  if (!accountId || !leadId) return {};

  const { data, error } = await supabase.rpc("resolve_document_template_merge_fields", {
    p_account_id: accountId,
    p_lead_id: leadId,
    p_estimate_id: estimateId,
    p_scope_of_work_override: scopeOfWorkOverride,
  });
  if (error) {
    console.error("resolve_document_template_merge_fields failed", { accountId, leadId, estimateId, error });
    return {};
  }

  return toMergeFieldsRecord(data);
}

function missingJobDocumentsColumn(error: unknown): "config_id" | "resolved_merge_fields" | null {
  if (!error || typeof error !== "object") return null;
  const code = String((error as { code?: string }).code || "");
  const message = [
    (error as { message?: string }).message,
    (error as { details?: string }).details,
    (error as { hint?: string }).hint,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  const isMissingColumn =
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist");

  if (!isMissingColumn) return null;
  if (message.includes("resolved_merge_fields")) return "resolved_merge_fields";
  if (message.includes("config_id")) return "config_id";
  return null;
}

function sanitizeStorageFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

function buildDocumentKey(config: any) {
  const configId = normalizeText(config?.id);
  const templateId = normalizeText(config?.template_id || config?.template?.id);
  const systemKey = normalizeText(config?.template?.system_key);
  if (systemKey && configId) return `${systemKey}_${configId}`;
  if (templateId && configId) return `template_${templateId}_${configId}`;
  return systemKey || templateId || "document";
}

export async function persistSignedJobDocumentPdfs(params: {
  supabase: any;
  supabaseUrl: string;
  accountId: string;
  acceptedAt: string;
  signaturePublicUrl: string;
  customerName: string;
  mergeFields: Record<string, string>;
  targets: SignedDocumentTarget[];
}): Promise<{
  ok: true;
  attachments: SignedDocumentAttachment[];
  documentSummaries: PersistedSignedDocument[];
} | { ok: false; error: string }> {
  const {
    supabase,
    supabaseUrl,
    accountId,
    acceptedAt,
    signaturePublicUrl,
    customerName,
    mergeFields,
    targets,
  } = params;

  const attachments: SignedDocumentAttachment[] = [];
  const documentSummaries: PersistedSignedDocument[] = [];

  for (const [index, target] of targets.entries()) {
    const { config, uploadedDocument = null, bodyOverride = null } = target;
    const title = normalizeText(config?.template?.name || uploadedDocument?.file_name) || "Document";
    const templateBody = renderTemplate(resolveTemplateBody(config?.template, bodyOverride), mergeFields);
    const fallbackBody =
      `${title}\n\nSigned electronically by ${customerName} on ${new Date(acceptedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.`;
    const attachment = await buildSignedTemplatePdf({
      title,
      body: templateBody || fallbackBody,
      customerName,
      prefix: sanitizeStorageFilePart(title),
      includeSignatureSection: true,
      signatureImageUrl: signaturePublicUrl,
      signatureDateIso: acceptedAt,
    });

    const leadId = normalizeText(uploadedDocument?.lead_id || config?.lead_id);
    const templateId = normalizeText(config?.template_id || config?.template?.id || uploadedDocument?.template_id);
    const configId = normalizeText(config?.id || uploadedDocument?.config_id);
    if (!leadId || !accountId) {
      return { ok: false, error: "Missing signed document storage context." };
    }

    const filePath = `${accountId}/${leadId}/${templateId || configId || "document"}-${Date.now()}-${index}-signed.pdf`;
    const contentType = attachment.contentType || "application/pdf";
    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(filePath, attachment.content, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, error: "Failed to save signed document PDF." };
    }

    const identityPayload = {
      lead_id: leadId,
      account_id: accountId,
      template_id: templateId || null,
      config_id: configId || null,
      document_key: buildDocumentKey(config),
    };

    const basePayload = {
      file_name: attachment.filename,
      file_path: filePath,
      mime_type: contentType,
      resolved_merge_fields: mergeFields,
      updated_at: acceptedAt,
    };

    const documentId = normalizeText(uploadedDocument?.id);
    let saveError: unknown = null;
    if (documentId) {
      let updatePayload: Record<string, unknown> = {
        ...identityPayload,
        ...basePayload,
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error: updateError } = await supabase
          .from("job_documents")
          .update(updatePayload)
          .eq("id", documentId);

        const missingColumn = missingJobDocumentsColumn(updateError);
        if (missingColumn && missingColumn in updatePayload) {
          const { [missingColumn]: _ignoredMissingColumn, ...legacyPayload } = updatePayload;
          updatePayload = legacyPayload;
          continue;
        }

        saveError = updateError;
        break;
      }
    } else {
      let insertPayload: Record<string, unknown> = {
        ...identityPayload,
        uploaded_by: null,
        ...basePayload,
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error: insertError } = await supabase
          .from("job_documents")
          .insert(insertPayload);

        const missingColumn = missingJobDocumentsColumn(insertError);
        if (missingColumn && missingColumn in insertPayload) {
          const { [missingColumn]: _ignoredMissingColumn, ...legacyPayload } = insertPayload;
          insertPayload = legacyPayload;
          continue;
        }

        saveError = insertError;
        break;
      }
    }

    if (saveError) {
      console.error("Failed to persist signed document PDF:", saveError);
      await supabase.storage.from("job-documents").remove([filePath]);
      return { ok: false, error: "Failed to persist signed document PDF." };
    }

    attachments.push(attachment);
    documentSummaries.push({
      name: title,
      url: `${supabaseUrl}/storage/v1/object/public/job-documents/${filePath}`,
    });
  }

  return { ok: true, attachments, documentSummaries };
}
