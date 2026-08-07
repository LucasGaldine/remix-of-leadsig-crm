import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Eye, Loader2, Plus, Send, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DOCUMENT_TEMPLATE_VARIABLES,
  extractDocumentTemplateVariableKeys,
  findMissingDocumentTemplateVariableKeys,
  getDocumentTemplateSourceText,
  type DocumentTemplateMergeFields,
  type DocumentTemplateRecord,
  getDocumentFallbackText,
} from "@/lib/documentTemplates";
import { buildClientPortalShareUrl } from "@/lib/clientPortalUrl";
import { buildSignedTemplateDocumentPDFBlob, buildTemplateDocumentPDFBlob } from "@/lib/pdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type JobDocumentType = "estimate" | "job_agreement" | "warranty" | "job_release";

interface JobDocumentRecord {
  id: string;
  template_id: string | null;
  config_id: string | null;
  document_key: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
  resolved_merge_fields?: DocumentTemplateMergeFields | null;
}

interface JobDocumentConfigRecord {
  id: string;
  lead_id: string;
  account_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: string;
  requires_signature: boolean;
  sort_order: number;
  shared_at: string | null;
  merge_fields_override: DocumentTemplateMergeFields;
  template: DocumentTemplateRecord | null;
}

interface JobReleaseRecord {
  release_text: string | null;
  status: string | null;
  signed_at: string | null;
  signature_image_url: string | null;
}

interface SendDocumentDialogState {
  config: JobDocumentConfigRecord;
  template: DocumentTemplateRecord;
  templateVariableKeys: string[];
  fieldValues: Record<string, string>;
}

interface JobDocumentsSectionProps {
  leadId: string;
  estimateId?: string | null;
  estimateStatus?: string | null;
  estimateHasPendingChanges?: boolean;
  onViewEstimate?: () => void;
  onBuildEstimate?: () => void;
  accountId?: string | null;
  userId?: string | null;
  estimateAgreementAcceptance?: Record<string, unknown> | null;
  estimateSignatureImageUrl?: string | null;
  estimateSignedAt?: string | null;
  templateMergeFields?: DocumentTemplateMergeFields | null;
}

const ESTIMATE_DOCUMENT_CONFIG: { type: JobDocumentType; label: string } = {
  type: "estimate",
  label: "Estimate",
};

const LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY: Record<string, string> = {
  job_agreement: "job_agreement",
  warranty_agreement: "warranty",
  job_release: "job_release",
};
const defaultConfigSeedInFlightByLead = new Set<string>();

const VARIABLE_DEFINITION_BY_KEY = DOCUMENT_TEMPLATE_VARIABLES.reduce((acc, variable) => {
  acc[variable.key] = variable;
  return acc;
}, {} as Record<string, { key: string; label: string; description: string }>);

const toCleanMergeFieldValue = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
};

const normalizeMergeFieldsRecord = (value: unknown): DocumentTemplateMergeFields => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const next: DocumentTemplateMergeFields = {};
  for (const [key, rawValue] of Object.entries(raw)) {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (!normalizedKey) continue;
    const cleanedValue = toCleanMergeFieldValue(rawValue);
    if (cleanedValue === undefined) continue;
    next[normalizedKey] = cleanedValue;
  }
  return next;
};

const mergeTemplateFieldMaps = (...maps: Array<DocumentTemplateMergeFields | null | undefined>) => {
  const next: DocumentTemplateMergeFields = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [rawKey, rawValue] of Object.entries(map)) {
      const normalizedKey = String(rawKey || "").trim().toLowerCase();
      if (!normalizedKey) continue;
      const cleanedValue = toCleanMergeFieldValue(rawValue);
      if (cleanedValue === undefined) continue;
      next[normalizedKey] = cleanedValue;
    }
  }
  return next;
};

const toTemplateVariableLabel = (key: string) => {
  const definition = VARIABLE_DEFINITION_BY_KEY[key];
  if (definition?.label) return definition.label;
  return key
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const isConfigIdColumnMissing = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code || "");
  const message = String((error as { message?: string }).message || "").toLowerCase();
  return code === "42703" && message.includes("job_documents.config_id");
};

const isMissingColumnError = (error: unknown, qualifiedColumnName: string): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code || "");
  const message = String((error as { message?: string }).message || "").toLowerCase();
  return code === "42703" && message.includes(qualifiedColumnName.toLowerCase());
};

const isMergeFieldsOverrideColumnMissing = (error: unknown): boolean =>
  isMissingColumnError(error, "job_document_configs.merge_fields_override");

const isSharedAtColumnMissing = (error: unknown): boolean =>
  isMissingColumnError(error, "job_document_configs.shared_at");

const isResolvedMergeFieldsColumnMissing = (error: unknown): boolean =>
  isMissingColumnError(error, "job_documents.resolved_merge_fields");

const normalizeEmailTimingValue = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isEstimateApprovalDocumentConfig = (config: Pick<JobDocumentConfigRecord, "email_timing">) =>
  normalizeEmailTimingValue(config.email_timing) === "on_estimate_approval";

const isSharedDocumentConfig = (config: Pick<JobDocumentConfigRecord, "email_timing" | "shared_at">) =>
  isEstimateApprovalDocumentConfig(config) || Boolean(config.shared_at);

const isSignedJobReleaseDocument = (
  config: Pick<JobDocumentConfigRecord, "template">,
  jobRelease: Pick<JobReleaseRecord, "status" | "signed_at"> | null,
) =>
  config.template?.system_key === "job_release" &&
  (String(jobRelease?.status || "").trim().toLowerCase() === "signed" || Boolean(jobRelease?.signed_at));

const isAcceptedDocumentConfig = (
  config: Pick<JobDocumentConfigRecord, "id">,
  estimateAgreementAcceptance: Record<string, unknown> | null | undefined,
) => estimateAgreementAcceptance?.[config.id] === true;

const normalizeJobDocumentConfigRows = (rows: unknown[]): JobDocumentConfigRecord[] =>
  rows.map((row) => {
    const record = row as Record<string, any>;
    const rawTemplate = record.template;
    const template = Array.isArray(rawTemplate)
      ? (rawTemplate[0] as DocumentTemplateRecord | undefined) || null
      : (rawTemplate as DocumentTemplateRecord | null);

    return {
      id: String(record.id || ""),
      lead_id: String(record.lead_id || ""),
      account_id: String(record.account_id || ""),
      template_id: String(record.template_id || ""),
      include_in_job: Boolean(record.include_in_job),
      email_timing: String(record.email_timing || "never"),
      requires_signature: Boolean(record.requires_signature),
      sort_order: Number(record.sort_order || 0),
      shared_at: record.shared_at ? String(record.shared_at) : null,
      merge_fields_override: normalizeMergeFieldsRecord(record.merge_fields_override),
      template,
    } as JobDocumentConfigRecord;
  });

const buildJobDocumentConfigSelect = ({
  includeMergeFieldsOverride,
  includeSharedAt,
}: {
  includeMergeFieldsOverride: boolean;
  includeSharedAt: boolean;
}) => {
  const columns = [
    "id",
    "lead_id",
    "account_id",
    "template_id",
    "include_in_job",
    "email_timing",
    "requires_signature",
    "sort_order",
    includeSharedAt ? "shared_at" : "",
    includeMergeFieldsOverride ? "merge_fields_override" : "",
    "created_by",
    "created_at",
    "updated_at",
    "template:document_templates(id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at)",
  ].filter(Boolean);

  return columns.join(", ");
};

export function JobDocumentsSection({
  leadId,
  estimateId = null,
  estimateStatus = null,
  estimateHasPendingChanges = false,
  onViewEstimate,
  onBuildEstimate,
  accountId = null,
  userId = null,
  estimateAgreementAcceptance = null,
  estimateSignatureImageUrl = null,
  estimateSignedAt = null,
  templateMergeFields = null,
}: JobDocumentsSectionProps) {
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [jobDocumentConfigs, setJobDocumentConfigs] = useState<JobDocumentConfigRecord[]>([]);
  const [documentsByKey, setDocumentsByKey] = useState<Record<string, JobDocumentRecord>>({});
  const [jobReleaseText, setJobReleaseText] = useState<string | null>(null);
  const [jobRelease, setJobRelease] = useState<JobReleaseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [sendDocumentDialog, setSendDocumentDialog] = useState<SendDocumentDialogState | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [sendingConfigId, setSendingConfigId] = useState<string | null>(null);
  const [viewingConfigId, setViewingConfigId] = useState<string | null>(null);
  const [removingConfigId, setRemovingConfigId] = useState<string | null>(null);
  const templateById = useMemo(
    () =>
      templates.reduce((acc, template) => {
        acc[template.id] = template;
        return acc;
      }, {} as Record<string, DocumentTemplateRecord>),
    [templates],
  );

  const configsWithTemplate = useMemo(
    () =>
      jobDocumentConfigs
        .map((config) => ({
          ...config,
          template: config.template || templateById[config.template_id] || null,
        }))
        .filter((config) => Boolean(config.template))
        .sort((a, b) => a.sort_order - b.sort_order),
    [jobDocumentConfigs, templateById],
  );
  const configuredTemplateIds = useMemo(
    () => new Set(jobDocumentConfigs.map((config) => config.template_id).filter(Boolean)),
    [jobDocumentConfigs],
  );
  const availableTemplates = useMemo(
    () =>
      [...templates].sort((a, b) => {
        const aConfigured = configuredTemplateIds.has(a.id);
        const bConfigured = configuredTemplateIds.has(b.id);
        if (aConfigured !== bConfigured) return aConfigured ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [configuredTemplateIds, templates],
  );
  const selectedTemplate = useMemo(
    () => availableTemplates.find((template) => template.id === selectedTemplateId) || null,
    [availableTemplates, selectedTemplateId],
  );
  const selectedTemplateRequiresManualSend = selectedTemplate?.default_email_timing === "manual";

  const fetchDocuments = useCallback(async () => {
    if (!leadId || !accountId) {
      setTemplates([]);
      setJobDocumentConfigs([]);
      setDocumentsByKey({});
      setJobReleaseText(null);
      setJobRelease(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const readJobDocumentConfigs = ({
      includeMergeFieldsOverride,
      includeSharedAt,
    }: {
      includeMergeFieldsOverride: boolean;
      includeSharedAt: boolean;
    }) =>
      supabase
        .from("job_document_configs")
        .select(buildJobDocumentConfigSelect({ includeMergeFieldsOverride, includeSharedAt }))
        .eq("lead_id", leadId)
        .order("sort_order", { ascending: true });

    const [templateResult, initialConfigResult, releaseResult] = await Promise.all([
      supabase
        .from("document_templates")
        .select("id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
      readJobDocumentConfigs({ includeMergeFieldsOverride: true, includeSharedAt: true }),
      supabase
        .from("job_releases")
        .select("release_text, status, signed_at, signature_image_url")
        .eq("lead_id", leadId)
        .maybeSingle(),
    ]);
    let configResult = initialConfigResult;
    if (isSharedAtColumnMissing(configResult.error)) {
      configResult = await readJobDocumentConfigs({
        includeMergeFieldsOverride: true,
        includeSharedAt: false,
      });
    }
    if (isMergeFieldsOverrideColumnMissing(configResult.error)) {
      configResult = await readJobDocumentConfigs({
        includeMergeFieldsOverride: false,
        includeSharedAt: true,
      });
    }
    if (isSharedAtColumnMissing(configResult.error) || isMergeFieldsOverrideColumnMissing(configResult.error)) {
      configResult = await readJobDocumentConfigs({
        includeMergeFieldsOverride: false,
        includeSharedAt: false,
      });
    }

    let documentResult = await supabase
      .from("job_documents")
      .select("id, template_id, config_id, document_key, file_name, file_path, mime_type, created_at, resolved_merge_fields")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (isConfigIdColumnMissing(documentResult.error)) {
      documentResult = await supabase
        .from("job_documents")
        .select("id, template_id, document_key, file_name, file_path, mime_type, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
    } else if (isResolvedMergeFieldsColumnMissing(documentResult.error)) {
      documentResult = await supabase
        .from("job_documents")
        .select("id, template_id, config_id, document_key, file_name, file_path, mime_type, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
    }

    if (templateResult.error) {
      console.error("Failed to fetch document templates:", templateResult.error);
      toast.error("Failed to load document templates");
      setTemplates([]);
    } else {
      setTemplates((templateResult.data || []) as DocumentTemplateRecord[]);
    }

    if (configResult.error) {
      console.error("Failed to fetch job document configs:", configResult.error);
      setJobDocumentConfigs([]);
    } else {
      setJobDocumentConfigs(normalizeJobDocumentConfigRows((configResult.data || []) as unknown[]));
    }

    if (documentResult.error) {
      console.error("Failed to fetch job documents:", documentResult.error);
      setDocumentsByKey({});
    } else {
      const next: Record<string, JobDocumentRecord> = {};
      for (const rawDocument of (documentResult.data || []) as JobDocumentRecord[]) {
        const configKey = rawDocument.config_id ? `config:${rawDocument.config_id}` : "";
        const templateKey = rawDocument.template_id ? `template:${rawDocument.template_id}` : "";
        const key = configKey || templateKey || `legacy:${rawDocument.document_key}`;
        if (!key || next[key]) continue;
        next[key] = rawDocument;
      }
      setDocumentsByKey(next);
    }

    if (releaseResult.error) {
      console.error("Failed to fetch job release text:", releaseResult.error);
      setJobReleaseText(null);
      setJobRelease(null);
    } else {
      const release = releaseResult.data as JobReleaseRecord | null;
      setJobReleaseText(release?.release_text || null);
      setJobRelease(release);
    }

    setIsLoading(false);

    const templateRows = (templateResult.data || []) as DocumentTemplateRecord[];
    const configRows = normalizeJobDocumentConfigRows((configResult.data || []) as unknown[]);
    const canBootstrapDefaultConfigs = !configResult.error;
    if (canBootstrapDefaultConfigs && configRows.length === 0 && templateRows.length > 0) {
      if (defaultConfigSeedInFlightByLead.has(leadId)) {
        return;
      }

      const defaults = templateRows.filter((template) => template.default_included_in_jobs);
      if (defaults.length > 0) {
        defaultConfigSeedInFlightByLead.add(leadId);
        try {
          const existingConfigResult = await supabase
            .from("job_document_configs")
            .select("id, template_id")
            .eq("lead_id", leadId);

          if (existingConfigResult.error) {
            console.error("Failed to confirm existing document configs before default seed:", existingConfigResult.error);
            return;
          }

          const existingTemplateIds = new Set(
            ((existingConfigResult.data || []) as Array<{ template_id?: string | null }>)
              .map((row) => String(row.template_id || ""))
              .filter(Boolean),
          );

          const templatesToInsert = defaults.filter((template) => !existingTemplateIds.has(template.id));
          if (templatesToInsert.length === 0) return;

          const insertPayload = templatesToInsert.map((template, index) => ({
            lead_id: leadId,
            account_id: accountId,
            template_id: template.id,
            include_in_job: true,
            email_timing: template.default_email_timing,
            requires_signature: template.default_requires_signature,
            sort_order: index + existingTemplateIds.size,
            created_by: userId ?? null,
          }));

          const { error: insertError } = await supabase
            .from("job_document_configs")
            .insert(insertPayload);

          if (insertError) {
            console.error("Failed to create default job document configs:", insertError);
            return;
          }

          await fetchDocuments();
        } finally {
          defaultConfigSeedInFlightByLead.delete(leadId);
        }
      }
    }
  }, [accountId, leadId, userId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!addDocumentOpen) {
      setSelectedTemplateId("");
      return;
    }

    if (availableTemplates.length === 0) {
      setSelectedTemplateId("");
      return;
    }

    const selectedTemplateStillAvailable = availableTemplates.some((template) => template.id === selectedTemplateId);
    if (!selectedTemplateId || !selectedTemplateStillAvailable) {
      setSelectedTemplateId(availableTemplates[0].id);
    }
  }, [addDocumentOpen, availableTemplates, selectedTemplateId]);

  const getUploadedDocumentUrl = (document: JobDocumentRecord) =>
    supabase.storage.from("job-documents").getPublicUrl(document.file_path).data.publicUrl;

  const isGeneratedSignedCopy = (document: JobDocumentRecord) =>
    /-signed\.pdf$/i.test(String(document.file_path || ""));

  const normalizePublicStorageUrl = (url: string | null | undefined, bucket: string) => {
    const rawUrl = String(url || "").trim();
    if (!rawUrl) return null;

    try {
      const parsedUrl = new URL(rawUrl);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerIndex = parsedUrl.pathname.indexOf(marker);
      if (markerIndex === -1) return rawUrl;

      const filePath = decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
      if (!filePath) return rawUrl;
      return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl || rawUrl;
    } catch {
      return rawUrl;
    }
  };

  const openDocumentUrl = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sanitizeDocumentFileName = (value: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || "document";
  };

  const resolveTemplateMergeFields = (
    config: Pick<JobDocumentConfigRecord, "merge_fields_override">,
    additionalOverrides?: DocumentTemplateMergeFields | null,
  ) => mergeTemplateFieldMaps(templateMergeFields, config.merge_fields_override, additionalOverrides);

  const getTemplateSourceText = (template: DocumentTemplateRecord) => getDocumentTemplateSourceText({
    template,
    jobReleaseText,
  });

  const openSendDocumentDialog = (
    config: JobDocumentConfigRecord,
    template: DocumentTemplateRecord,
    templateVariableKeys: string[],
    effectiveMergeFields: DocumentTemplateMergeFields,
  ) => {
    const fieldValues = templateVariableKeys.reduce((acc, key) => {
      const next = effectiveMergeFields[key];
      acc[key] = next === null || next === undefined ? "" : String(next);
      return acc;
    }, {} as Record<string, string>);

    setSendDocumentDialog({
      config,
      template,
      templateVariableKeys,
      fieldValues,
    });
  };

  const getUploadedDocumentForConfig = (
    config: Pick<JobDocumentConfigRecord, "id" | "template_id" | "template">,
  ) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template) return null;

    const directByConfig = documentsByKey[`config:${config.id}`];
    if (directByConfig) return directByConfig;

    // Legacy compatibility: older rows may not have config_id, but document_key embeds config.id.
    const directByConfigKey = Object.values(documentsByKey).find((document) =>
      String(document.document_key || "").endsWith(`_${config.id}`),
    );
    if (directByConfigKey) return directByConfigKey;

    const templateMatches = configsWithTemplate.filter((item) => item.template_id === template.id);
    const hasDuplicatesForTemplate = templateMatches.length > 1;
    if (hasDuplicatesForTemplate) return null;

    const direct = documentsByKey[`template:${template.id}`];
    if (direct) return direct;

    const legacyKey = template.system_key ? LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY[template.system_key] : null;
    if (!legacyKey) return null;

    return documentsByKey[`legacy:${legacyKey}`] || null;
  };

  const isUploadedDocumentCompatibleWithConfig = (
    document: JobDocumentRecord,
    config: Pick<JobDocumentConfigRecord, "id">,
    template: DocumentTemplateRecord,
  ) => {
    if (document.config_id && document.config_id !== config.id) return false;
    if (document.template_id && document.template_id !== template.id) return false;
    return true;
  };

  const getSignedDocumentMetadata = (
    config: Pick<JobDocumentConfigRecord, "id" | "template">,
  ): { signatureImageUrl: string | null; signedAt: string | null } | null => {
    if (isSignedJobReleaseDocument(config, jobRelease)) {
      return {
        signatureImageUrl: normalizePublicStorageUrl(jobRelease?.signature_image_url, "lead-photos"),
        signedAt: jobRelease?.signed_at || null,
      };
    }

    if (isAcceptedDocumentConfig(config, estimateAgreementAcceptance)) {
      return {
        signatureImageUrl: normalizePublicStorageUrl(estimateSignatureImageUrl, "lead-photos"),
        signedAt:
          estimateSignedAt ||
          (typeof estimateAgreementAcceptance?.accepted_at === "string"
            ? estimateAgreementAcceptance.accepted_at
            : null),
      };
    }

    return null;
  };

  const createTemplatePdfForView = async ({
    config,
    template,
    content,
    effectiveMergeFields,
    signedMetadata = null,
    existingDocument = null,
  }: {
    config: JobDocumentConfigRecord;
    template: DocumentTemplateRecord;
    content: string;
    effectiveMergeFields: DocumentTemplateMergeFields;
    signedMetadata?: { signatureImageUrl: string | null; signedAt: string | null } | null;
    existingDocument?: JobDocumentRecord | null;
  }) => {
    if (!leadId || !accountId || !userId) {
      toast.error("Missing document context");
      return null;
    }

    const fileNameBase = sanitizeDocumentFileName(template.name || "document");
    const fileName = `${fileNameBase}.pdf`;
    const filePath = `${accountId}/${leadId}/${template.id}-${Date.now()}${signedMetadata ? "-signed" : ""}.pdf`;
    const pdfPayload = {
      title: template.name || "Document",
      fileName: template.name || "Document",
      content,
      requiresSignature: Boolean(config.requires_signature),
      ...(signedMetadata
        ? {
            signatureImageUrl: signedMetadata.signatureImageUrl || undefined,
            signedAt: signedMetadata.signedAt || undefined,
          }
        : {}),
    };
    const fileBlob = signedMetadata
      ? await buildSignedTemplateDocumentPDFBlob(pdfPayload)
      : buildTemplateDocumentPDFBlob(pdfPayload);

    if (!fileBlob) {
      toast.error("Failed to create document PDF");
      return null;
    }

    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(filePath, fileBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload job document:", uploadError);
      toast.error("Failed to create document PDF");
      return null;
    }

    const documentPayload: Record<string, unknown> = {
      lead_id: leadId,
      account_id: accountId,
      template_id: template.id,
      config_id: config.id,
      document_key: template.system_key
        ? `${template.system_key}_${config.id}`
        : `template_${template.id}_${config.id}`,
      file_name: fileName,
      file_path: filePath,
      mime_type: "application/pdf",
      resolved_merge_fields: effectiveMergeFields,
      uploaded_by: userId,
    };

    let saveError: unknown = null;
    if (existingDocument?.id) {
      const updatePayload = {
        template_id: template.id,
        config_id: config.id,
        document_key: documentPayload.document_key,
        file_name: fileName,
        file_path: filePath,
        mime_type: "application/pdf",
        resolved_merge_fields: effectiveMergeFields,
        uploaded_by: userId,
        updated_at: new Date().toISOString(),
      };
      let { error: updateError } = await supabase
        .from("job_documents")
        .update(updatePayload)
        .eq("id", existingDocument.id);

      if (isResolvedMergeFieldsColumnMissing(updateError)) {
        const { resolved_merge_fields: _ignoredResolvedMergeFields, ...legacyPayload } = updatePayload;
        const retryResult = await supabase
          .from("job_documents")
          .update(legacyPayload)
          .eq("id", existingDocument.id);
        updateError = retryResult.error;
      }

      saveError = updateError;
    } else {
      let { error: insertError } = await supabase
        .from("job_documents")
        .insert(documentPayload);

      if (isConfigIdColumnMissing(insertError)) {
        const { config_id: _ignoredConfigId, ...legacyInsertPayload } = documentPayload;
        const legacyResult = await supabase
          .from("job_documents")
          .insert(legacyInsertPayload);
        insertError = legacyResult.error;
      } else if (isResolvedMergeFieldsColumnMissing(insertError)) {
        const { resolved_merge_fields: _ignoredResolvedMergeFields, ...legacyPayload } = documentPayload;
        const retryResult = await supabase
          .from("job_documents")
          .insert(legacyPayload);
        insertError = retryResult.error;
      }

      saveError = insertError;
    }

    if (saveError) {
      console.error("Failed to save job document:", saveError);
      toast.error("Failed to save document PDF");
      return null;
    }

    const document: JobDocumentRecord = {
      id: existingDocument?.id || `generated:${filePath}`,
      template_id: template.id,
      config_id: config.id,
      document_key: String(documentPayload.document_key || ""),
      file_name: fileName,
      file_path: filePath,
      mime_type: "application/pdf",
      created_at: existingDocument?.created_at || new Date().toISOString(),
      resolved_merge_fields: effectiveMergeFields,
    };

    setDocumentsByKey((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(next)) {
        if (value.id === document.id) delete next[key];
      }
      next[`config:${config.id}`] = document;
      return next;
    });

    return document;
  };

  const handleViewTemplateDocument = async (config: JobDocumentConfigRecord) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template) {
      toast.error("Template not found");
      return;
    }

    const uploadedDocument = getUploadedDocumentForConfig(config);
    const signedMetadata = getSignedDocumentMetadata(config);
    const canOpenUploadedDocument =
      uploadedDocument &&
      isUploadedDocumentCompatibleWithConfig(uploadedDocument, config, template) &&
      (!signedMetadata || isGeneratedSignedCopy(uploadedDocument));
    if (canOpenUploadedDocument) {
      openDocumentUrl(getUploadedDocumentUrl(uploadedDocument));
      return;
    }

    const effectiveMergeFields = resolveTemplateMergeFields(config);

    const fallbackText = getDocumentFallbackText({
      template,
      jobReleaseText,
      templateMergeFields: effectiveMergeFields,
    });

    if (!fallbackText?.trim()) {
      toast.error("No document available yet");
      return;
    }

    setViewingConfigId(config.id);
    try {
      const createdDocument = await createTemplatePdfForView({
        config,
        template,
        content: fallbackText,
        effectiveMergeFields,
        signedMetadata,
        existingDocument: uploadedDocument,
      });
      if (createdDocument) {
        openDocumentUrl(getUploadedDocumentUrl(createdDocument));
      }
    } finally {
      setViewingConfigId(null);
    }
  };

  const addTemplateToJob = async (template: DocumentTemplateRecord) => {
    if (!leadId || !accountId || !userId) {
      toast.error("Missing job context");
      return null;
    }

    const nextSortOrder = Math.max(
      ...jobDocumentConfigs.map((config) => Number(config.sort_order || 0)),
      configsWithTemplate.length,
      0,
    ) + 1;

    const { data, error } = await supabase
      .from("job_document_configs")
      .insert({
        lead_id: leadId,
        account_id: accountId,
        template_id: template.id,
        include_in_job: true,
        email_timing: template.default_email_timing,
        requires_signature: template.default_requires_signature,
        sort_order: nextSortOrder,
        created_by: userId,
      })
      .select(
        "id, lead_id, account_id, template_id, include_in_job, email_timing, requires_signature, sort_order, shared_at, merge_fields_override, created_by, created_at, updated_at, template:document_templates(id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at)",
      )
      .single();

    if (error) {
      if (String(error.code || "") === "23505") {
        toast.error("This template is already added to the job");
      } else {
        toast.error("Failed to add document");
      }
      console.error("Failed to add job document config:", error);
      return null;
    }

    const insertedConfig = normalizeJobDocumentConfigRows([data])[0];
    setJobDocumentConfigs((current) => [...current, insertedConfig]);
    return insertedConfig;
  };

  const sendTemplateDocument = async (
    config: JobDocumentConfigRecord,
    overrideMergeFields?: DocumentTemplateMergeFields | null,
  ) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template || !leadId || !accountId || !userId) {
      toast.error("Missing document context");
      return false;
    }

    const normalizedInputOverrides = normalizeMergeFieldsRecord(overrideMergeFields);
    const mergedConfigOverrides = mergeTemplateFieldMaps(config.merge_fields_override, normalizedInputOverrides);
    const effectiveMergeFields = resolveTemplateMergeFields({
      merge_fields_override: mergedConfigOverrides,
    });
    const templateSourceText = getTemplateSourceText(template);
    const missingVariableKeys = findMissingDocumentTemplateVariableKeys(templateSourceText, effectiveMergeFields);
    if (missingVariableKeys.length > 0) {
      openSendDocumentDialog(
        { ...config, merge_fields_override: mergedConfigOverrides, template },
        template,
        extractDocumentTemplateVariableKeys(templateSourceText),
        effectiveMergeFields,
      );
      return false;
    }

    if (Object.keys(normalizedInputOverrides).length > 0) {
      let { error: updateConfigError } = await supabase
        .from("job_document_configs")
        .update({ merge_fields_override: mergedConfigOverrides })
        .eq("id", config.id);

      if (isMergeFieldsOverrideColumnMissing(updateConfigError)) {
        updateConfigError = null;
      }

      if (updateConfigError) {
        console.error("Failed to save document merge fields:", updateConfigError);
        toast.error("Failed to save document values");
        return false;
      }

      setJobDocumentConfigs((current) =>
        current.map((item) =>
          item.id === config.id
            ? { ...item, merge_fields_override: mergedConfigOverrides }
            : item
        ),
      );
    }

    const fallbackText = getDocumentFallbackText({
      template,
      jobReleaseText,
      templateMergeFields: effectiveMergeFields,
    });

    if (!fallbackText?.trim()) {
      toast.error("No document text available to send");
      return false;
    }

    const fileNameBase = sanitizeDocumentFileName(template.name || "document");
    const fileName = `${fileNameBase}.pdf`;
    const filePath = `${accountId}/${leadId}/${template.id}-${Date.now()}.pdf`;
    setSendingConfigId(config.id);

    try {
      const fileBlob = buildTemplateDocumentPDFBlob({
        title: template.name || "Document",
        fileName: template.name || "Document",
        content: fallbackText,
        requiresSignature: Boolean(config.requires_signature),
      });

      const { error: uploadError } = await supabase.storage
        .from("job-documents")
        .upload(filePath, fileBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Failed to upload job document:", uploadError);
        toast.error("Failed to send document");
        return false;
      }

      let existingDocumentResult = await supabase
        .from("job_documents")
        .select("id")
        .eq("lead_id", leadId)
        .eq("config_id", config.id)
        .maybeSingle();

      if (isConfigIdColumnMissing(existingDocumentResult.error)) {
        existingDocumentResult = await supabase
          .from("job_documents")
          .select("id")
          .eq("lead_id", leadId)
          .eq("template_id", template.id)
          .maybeSingle();
      }

      const existingDocument = existingDocumentResult.data;
      const existingDocumentError = existingDocumentResult.error;

      if (existingDocumentError) {
        console.error("Failed to query existing job document:", existingDocumentError);
        toast.error("Failed to send document");
        return false;
      }

      if (existingDocument?.id) {
        let { error: updateError } = await supabase
          .from("job_documents")
          .update({
            file_name: fileName,
            file_path: filePath,
            mime_type: "application/pdf",
            resolved_merge_fields: effectiveMergeFields,
            uploaded_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDocument.id);

        if (isResolvedMergeFieldsColumnMissing(updateError)) {
          const retryResult = await supabase
            .from("job_documents")
            .update({
              file_name: fileName,
              file_path: filePath,
              mime_type: "application/pdf",
              uploaded_by: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingDocument.id);
          updateError = retryResult.error;
        }

        if (updateError) {
          console.error("Failed to update job document:", updateError);
          toast.error("Failed to send document");
          return false;
        }
      } else {
        const insertPayload: Record<string, unknown> = {
          lead_id: leadId,
          account_id: accountId,
          template_id: template.id,
          config_id: config.id,
          document_key: template.system_key
            ? `${template.system_key}_${config.id}`
            : `template_${template.id}_${config.id}`,
          file_name: fileName,
          file_path: filePath,
          mime_type: "application/pdf",
          resolved_merge_fields: effectiveMergeFields,
          uploaded_by: userId,
        };

        let { error: insertError } = await supabase
          .from("job_documents")
          .insert(insertPayload);

        if (isConfigIdColumnMissing(insertError)) {
          const { config_id: _ignoredConfigId, ...legacyInsertPayload } = insertPayload;
          const legacyResult = await supabase
            .from("job_documents")
            .insert(legacyInsertPayload);
          insertError = legacyResult.error;
        } else if (isResolvedMergeFieldsColumnMissing(insertError)) {
          const { resolved_merge_fields: _ignoredResolvedMergeFields, ...legacyPayload } = insertPayload;
          const retryResult = await supabase
            .from("job_documents")
            .insert(legacyPayload);
          insertError = retryResult.error;
        }

        if (insertError) {
          console.error("Failed to insert job document:", insertError);
          toast.error("Failed to send document");
          return false;
        }
      }

      const sharedAt = new Date().toISOString();
      let { error: updateSharedAtError } = await supabase
        .from("job_document_configs")
        .update({
          shared_at: sharedAt,
          updated_at: sharedAt,
        })
        .eq("id", config.id);

      if (isSharedAtColumnMissing(updateSharedAtError)) {
        updateSharedAtError = null;
      }

      if (updateSharedAtError) {
        console.error("Failed to mark job document as shared:", updateSharedAtError);
        toast.error("Failed to mark document as shared");
        return false;
      }

      setJobDocumentConfigs((current) =>
        current.map((item) =>
          item.id === config.id
            ? { ...item, shared_at: sharedAt }
            : item
        ),
      );

      await fetchDocuments();

      let emailStatus: "sent" | "skipped" | "failed" = "skipped";
      let emailErrorMessage = "";
      let emailedRecipient = "";
      try {
        const leadResult = await supabase
          .from("leads")
          .select("id, name, customer_id, estimate_job_id")
          .eq("id", leadId)
          .maybeSingle();
        const lead = leadResult.data;
        if (lead) {
          let resolvedCustomerId = lead.customer_id ? String(lead.customer_id) : "";
          let token = "";

          if (lead.estimate_job_id) {
            const parentResult = await supabase
              .from("leads")
              .select("customer_id")
              .eq("id", String(lead.estimate_job_id))
              .maybeSingle();
            if (!resolvedCustomerId && parentResult.data?.customer_id) {
              resolvedCustomerId = String(parentResult.data.customer_id);
            }
          }

          if (resolvedCustomerId) {
            const customerResult = await supabase
              .from("customers")
              .select("id, client_portal_token")
              .eq("id", resolvedCustomerId)
              .maybeSingle();
            token = String(customerResult.data?.client_portal_token || "");

            if (!token) {
              const generatedToken = crypto.randomUUID();
              const { error: tokenUpdateError } = await supabase
                .from("customers")
                .update({ client_portal_token: generatedToken })
                .eq("id", resolvedCustomerId);

              if (tokenUpdateError) {
                emailStatus = "failed";
                emailErrorMessage = "Could not generate a client portal token for this customer.";
              } else {
                token = generatedToken;
              }
            }
          } else {
            emailStatus = "failed";
            emailErrorMessage = "Missing customer on this job; cannot send signature-request email.";
          }

          if (token && emailStatus !== "failed") {
            if (!resolvedCustomerId) {
              emailStatus = "failed";
              emailErrorMessage = "Missing customer on this job; cannot send signature-request email.";
            }
          }

          if (token && emailStatus !== "failed" && resolvedCustomerId) {
            const accountResult = await supabase
              .from("accounts")
              .select("settings")
              .eq("id", accountId)
              .maybeSingle();
            const customDomain =
              ((accountResult.data?.settings as { website?: { custom_domain?: string | null } } | null)?.website
                ?.custom_domain as string | null | undefined) ?? null;

            const portalLink = buildClientPortalShareUrl(token, {
              jobId: leadId,
              customDomain,
            });

            const authResult = await supabase.auth.refreshSession();
            const accessToken =
              authResult.data.session?.access_token ||
              (await supabase.auth.getSession()).data.session?.access_token;

            if (accessToken) {
              const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-client-portal-email", {
                headers: { Authorization: `Bearer ${accessToken}` },
                body: {
                  customer_id: resolvedCustomerId,
                  job_id: leadId,
                  job_name: lead.name || null,
                  portal_link: portalLink,
                  notification_type: config.requires_signature
                    ? "signature_required_document"
                    : "portal_link",
                  document_name: config.requires_signature ? (template.name || null) : null,
                  attachments: [
                    {
                      file_name: fileName,
                      file_path: filePath,
                      mime_type: "application/pdf",
                    },
                  ],
                },
              });
              if (emailError) {
                emailStatus = "failed";
                emailErrorMessage = emailError.message || "Failed to send client portal email.";
                console.error("Failed to send client portal email after manual document send:", emailError);
              } else {
                const recipientEmail = String(
                  (emailResult as { recipient_email?: string } | null)?.recipient_email || "",
                ).trim();
                if (!recipientEmail) {
                  emailStatus = "failed";
                  emailErrorMessage = "Email service did not confirm the recipient address.";
                } else {
                  emailStatus = "sent";
                  emailedRecipient = recipientEmail;
                }
              }
            } else {
              emailStatus = "failed";
              emailErrorMessage = "Could not refresh auth session for email send.";
            }
          } else if (!token && emailStatus !== "failed") {
            emailStatus = "failed";
            emailErrorMessage = "Missing client portal token for this job.";
          }
        } else if (config.requires_signature) {
          emailStatus = "failed";
          emailErrorMessage = "Missing customer on this job; cannot send signature-request email.";
        }
      } catch (notificationError) {
        emailStatus = "failed";
        emailErrorMessage = notificationError instanceof Error
          ? notificationError.message
          : "Unexpected error sending client portal email.";
        console.error("Unexpected error sending client portal email after manual document send:", notificationError);
      }

      setSendDocumentDialog(null);
      if (emailStatus === "failed") {
        toast.warning(`Document sent, but email failed: ${emailErrorMessage}`);
      } else if (emailStatus === "sent") {
        toast.success(
          emailedRecipient
            ? `Document sent and emailed to ${emailedRecipient}`
            : "Document sent and emailed to the client",
        );
      } else {
        toast.success("Document sent");
      }
      return true;
    } finally {
      setSendingConfigId(null);
    }
  };

  const handleSendDocumentFieldValueChange = (key: string, value: string) => {
    setSendDocumentDialog((current) => {
      if (!current) return current;
      return {
        ...current,
        fieldValues: {
          ...current.fieldValues,
          [key]: value,
        },
      };
    });
  };

  const handleConfirmSendDocument = async () => {
    if (!sendDocumentDialog) return;
    const sent = await sendTemplateDocument(sendDocumentDialog.config, sendDocumentDialog.fieldValues);
    if (!sent) return;
    setSendDocumentDialog(null);
  };

  const handleManualSendRequest = (config: JobDocumentConfigRecord) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template) {
      toast.error("Template not found");
      return;
    }

    const templateSourceText = getTemplateSourceText(template);
    const templateVariableKeys = extractDocumentTemplateVariableKeys(templateSourceText);
    if (templateVariableKeys.length === 0) {
      void sendTemplateDocument(config);
      return;
    }

    openSendDocumentDialog(
      config,
      template,
      templateVariableKeys,
      resolveTemplateMergeFields(config),
    );
  };

  const handleAddTemplate = async ({ sendImmediately }: { sendImmediately: boolean }) => {
    if (!selectedTemplate || addingTemplate) return;

    setAddingTemplate(true);
    try {
      const addedConfig = await addTemplateToJob(selectedTemplate);
      if (!addedConfig) return;

      if (sendImmediately) {
        const template = addedConfig.template || templateById[addedConfig.template_id] || null;
        if (template && extractDocumentTemplateVariableKeys(getTemplateSourceText(template)).length > 0) {
          setAddDocumentOpen(false);
          handleManualSendRequest(addedConfig);
          return;
        }

        const sent = await sendTemplateDocument(addedConfig);
        if (!sent) return;
      }

      setAddDocumentOpen(false);
      toast.success(sendImmediately ? "Document added and sent" : "Document added");
    } finally {
      setAddingTemplate(false);
    }
  };

  const handleRemoveTemplateFromJob = async (config: JobDocumentConfigRecord) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template || !leadId || !accountId) {
      toast.error("Missing document context");
      return;
    }

    setRemovingConfigId(config.id);
    try {
      const uploadedDocument = getUploadedDocumentForConfig(config);

      if (uploadedDocument?.file_path) {
        const { error: storageDeleteError } = await supabase.storage
          .from("job-documents")
          .remove([uploadedDocument.file_path]);
        if (storageDeleteError) {
          console.error("Failed to remove document file:", storageDeleteError);
        }

        const { error: docDeleteError } = await supabase
          .from("job_documents")
          .delete()
          .eq("id", uploadedDocument.id);
        if (docDeleteError) {
          console.error("Failed to remove job document row:", docDeleteError);
          toast.error("Failed to remove document");
          return;
        }
      }

      const { error: configDeleteError } = await supabase
        .from("job_document_configs")
        .delete()
        .eq("id", config.id);

      if (configDeleteError) {
        console.error("Failed to remove job document config:", configDeleteError);
        toast.error("Failed to remove document");
        return;
      }

      setJobDocumentConfigs((current) => current.filter((item) => item.id !== config.id));
      if (uploadedDocument) {
        const configKey = `config:${config.id}`;
        const templateKey = `template:${template.id}`;
        const legacyKey = template.system_key ? `legacy:${LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY[template.system_key]}` : "";
        setDocumentsByKey((current) => {
          const next = { ...current };
          if (next[configKey]?.id === uploadedDocument.id) delete next[configKey];
          if (next[templateKey]?.id === uploadedDocument.id) delete next[templateKey];
          if (legacyKey && next[legacyKey]?.id === uploadedDocument.id) delete next[legacyKey];
          return next;
        });
      }
      toast.success("Document removed");
    } finally {
      setRemovingConfigId(null);
    }
  };

  const estimateDocument = documentsByKey["legacy:estimate"] || null;
  const canBuildEstimate = !estimateId && Boolean(onBuildEstimate);
  const canViewEstimate = Boolean((estimateId && onViewEstimate) || estimateDocument);
  const normalizedEstimateStatus = String(estimateStatus || "").trim().toLowerCase();
  const isEstimateApproved = normalizedEstimateStatus === "accepted";
  const isEstimatePendingChanges = estimateHasPendingChanges || normalizedEstimateStatus.includes("pending_change");
  const estimateStatusLabel = isEstimatePendingChanges
    ? "Pending changes"
    : isEstimateApproved
      ? "Approved"
      : "Unapproved";
  const estimateStatusClassName = isEstimatePendingChanges
    ? "text-amber-600"
    : isEstimateApproved
      ? "text-emerald-600"
      : "text-muted-foreground";
  const sendDialogTemplateSourceText = sendDocumentDialog
    ? getTemplateSourceText(sendDocumentDialog.template)
    : "";
  const sendDialogEffectiveMergeFields = sendDocumentDialog
    ? resolveTemplateMergeFields(sendDocumentDialog.config, sendDocumentDialog.fieldValues)
    : null;
  const sendDialogMissingKeys = sendDocumentDialog
    ? findMissingDocumentTemplateVariableKeys(sendDialogTemplateSourceText, sendDialogEffectiveMergeFields)
    : [];
  const isSendingFromSendDialog = Boolean(
    sendDocumentDialog && sendingConfigId === sendDocumentDialog.config.id,
  );

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-2">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-base md:text-sm font-medium text-foreground">{ESTIMATE_DOCUMENT_CONFIG.label}</p>
                <p className={`text-sm ${estimateStatusClassName}`}>
                  {estimateStatusLabel}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start">
                {canBuildEstimate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => onBuildEstimate?.()}
                  >
                    <Calculator className="h-4 w-4" />
                    Build
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => {
                      if (estimateDocument) {
                        openDocumentUrl(getUploadedDocumentUrl(estimateDocument));
                        return;
                      }

                      onViewEstimate?.();
                    }}
                    disabled={!canViewEstimate}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Job Documents</p>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Link
                to="/settings/document-templates"
                aria-label="Manage document settings"
                title="Manage document settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3">
            {configsWithTemplate.length === 0 ? (
              <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                No document templates are attached to this job yet.
              </div>
            ) : (
              configsWithTemplate.map((config) => {
                const template = config.template;
                if (!template) return null;
                const templateOccurrenceIndex = configsWithTemplate
                  .filter((item) => item.template_id === config.template_id)
                  .findIndex((item) => item.id === config.id);
                const templateInstanceNumber = templateOccurrenceIndex + 1;
                const templateDisplayName = templateInstanceNumber > 1
                  ? `${template.name} #${templateInstanceNumber}`
                  : template.name;

                const uploadedDocument = getUploadedDocumentForConfig(config);
                const fallbackText = getDocumentFallbackText({
                  template,
                  jobReleaseText,
                  templateMergeFields: resolveTemplateMergeFields(config),
                });
                const canView = Boolean(uploadedDocument || fallbackText);
                const isManualSend = config.email_timing === "manual";
                const canSendManual = isManualSend && !uploadedDocument;
                const isShared = isSharedDocumentConfig(config);
                const isSigned =
                  isSignedJobReleaseDocument(config, jobRelease) ||
                  isAcceptedDocumentConfig(config, estimateAgreementAcceptance);
                const documentStatusLabel = isSigned ? "Signed" : isShared ? "Shared" : "Not Shared";
                const documentStatusClassName = isSigned || isShared ? "text-emerald-600" : "text-muted-foreground";
                const isSending = sendingConfigId === config.id;
                const isViewing = viewingConfigId === config.id;
                const isRemoving = removingConfigId === config.id;
                return (
                  <div
                    key={config.id}
                    className="rounded-lg border border-border bg-background/60"
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base md:text-sm font-medium text-foreground">{templateDisplayName}</p>
                          <p className={`text-sm ${documentStatusClassName}`}>
                            {documentStatusLabel}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                          {canSendManual && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => handleManualSendRequest(config)}
                              disabled={isSending || isRemoving}
                            >
                              {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              Send
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap"
                            onClick={() => void handleViewTemplateDocument(config)}
                            disabled={!canView || isRemoving || isViewing}
                          >
                            {isViewing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${template.name}`}
                            title={`Remove ${template.name}`}
                            onClick={() => void handleRemoveTemplateFromJob(config)}
                            disabled={isSending || isRemoving}
                          >
                            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddDocumentOpen(true)}
              disabled={templates.length === 0}
              title={templates.length === 0 ? "No document templates are available" : undefined}
            >
              <Plus className="h-4 w-4" />
              Add Document
            </Button>
          </div>
        </>
      )}

      <Dialog open={addDocumentOpen} onOpenChange={setAddDocumentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>
              Choose a template from your document library to attach to this job.
            </DialogDescription>
          </DialogHeader>

          {availableTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates found. Add templates in settings first.</p>
          ) : (
            <div className="space-y-3">
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateRequiresManualSend && (
                <p className="text-xs text-muted-foreground">
                  This template is set to manual send. You can add it now or add and send immediately.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedTemplateRequiresManualSend && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAddTemplate({ sendImmediately: false })}
                disabled={!selectedTemplateId || addingTemplate}
              >
                {addingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add
              </Button>
            )}
            <Button
              type="button"
              onClick={() => void handleAddTemplate({ sendImmediately: selectedTemplateRequiresManualSend })}
              disabled={!selectedTemplateId || addingTemplate}
            >
              {addingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {selectedTemplateRequiresManualSend ? "Add & Send" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(sendDocumentDialog)}
        onOpenChange={(open) => {
          if (!open) setSendDocumentDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send document</DialogTitle>
            <DialogDescription>
              Review and update template values before generating the PDF.
            </DialogDescription>
          </DialogHeader>

          {sendDocumentDialog ? (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {sendDialogMissingKeys.length > 0 && (
                <p className="text-xs text-destructive">
                  Enter values for all required fields before sending.
                </p>
              )}
              {sendDocumentDialog.templateVariableKeys.map((key) => {
                const definition = VARIABLE_DEFINITION_BY_KEY[key];
                const isMissing = sendDialogMissingKeys.includes(key);
                return (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`document-field-${sendDocumentDialog.config.id}-${key}`}>
                      {toTemplateVariableLabel(key)}
                      {isMissing ? " *" : ""}
                    </Label>
                    <Input
                      id={`document-field-${sendDocumentDialog.config.id}-${key}`}
                      value={sendDocumentDialog.fieldValues[key] || ""}
                      onChange={(event) => handleSendDocumentFieldValueChange(key, event.target.value)}
                      placeholder={definition?.description || key}
                    />
                    <p className="text-xs text-muted-foreground">{`[[${key}]]`}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendDocumentDialog(null)}
              disabled={isSendingFromSendDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmSendDocument()}
              disabled={!sendDocumentDialog || isSendingFromSendDialog || sendDialogMissingKeys.length > 0}
            >
              {isSendingFromSendDialog ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
