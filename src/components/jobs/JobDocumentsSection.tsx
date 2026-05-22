import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Download, Eye, Loader2, Plus, Send, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  renderDocumentTemplateMarkdownHtml,
  type DocumentTemplateMergeFields,
  type DocumentTemplateRecord,
  getDocumentFallbackText,
} from "@/lib/documentTemplates";
import { buildTemplateDocumentPDFBlob, generateTemplateDocumentPDF } from "@/lib/pdfGenerator";
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
  template: DocumentTemplateRecord | null;
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
  estimateAgreementTemplates?: Record<string, unknown> | null;
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
      template,
    } as JobDocumentConfigRecord;
  });

export function JobDocumentsSection({
  leadId,
  estimateId = null,
  estimateStatus = null,
  estimateHasPendingChanges = false,
  onViewEstimate,
  onBuildEstimate,
  accountId = null,
  userId = null,
  estimateAgreementTemplates = null,
  templateMergeFields = null,
}: JobDocumentsSectionProps) {
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [jobDocumentConfigs, setJobDocumentConfigs] = useState<JobDocumentConfigRecord[]>([]);
  const [documentsByKey, setDocumentsByKey] = useState<Record<string, JobDocumentRecord>>({});
  const [jobReleaseText, setJobReleaseText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [sendingConfigId, setSendingConfigId] = useState<string | null>(null);
  const [removingConfigId, setRemovingConfigId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; content: string; fileName: string; requiresSignature: boolean } | null>(null);
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
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [templateResult, configResult, documentResult, releaseResult] = await Promise.all([
      supabase
        .from("document_templates")
        .select("id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
      supabase
        .from("job_document_configs")
        .select(
          "id, lead_id, account_id, template_id, include_in_job, email_timing, requires_signature, sort_order, created_by, created_at, updated_at, template:document_templates(id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at)",
        )
        .eq("lead_id", leadId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("job_documents")
        .select("id, template_id, config_id, document_key, file_name, file_path, mime_type, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_releases")
        .select("release_text")
        .eq("lead_id", leadId)
        .maybeSingle(),
    ]);

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
    } else {
      setJobReleaseText((releaseResult.data as { release_text?: string | null } | null)?.release_text || null);
    }

    setIsLoading(false);

    const templateRows = (templateResult.data || []) as DocumentTemplateRecord[];
    const configRows = normalizeJobDocumentConfigRows((configResult.data || []) as unknown[]);
    if (configRows.length === 0 && templateRows.length > 0 && userId) {
      const defaults = templateRows.filter((template) => template.default_included_in_jobs);
      if (defaults.length > 0) {
        const insertPayload = defaults.map((template, index) => ({
          lead_id: leadId,
          account_id: accountId,
          template_id: template.id,
          include_in_job: true,
          email_timing: template.default_email_timing,
          requires_signature: template.default_requires_signature,
          sort_order: index,
          created_by: userId,
        }));

        const { error: insertError } = await supabase
          .from("job_document_configs")
          .insert(insertPayload);

        if (insertError) {
          console.error("Failed to create default job document configs:", insertError);
          return;
        }

        await fetchDocuments();
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

  const getUploadedDocumentForConfig = (
    config: Pick<JobDocumentConfigRecord, "id" | "template_id" | "template">,
  ) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template) return null;

    const directByConfig = documentsByKey[`config:${config.id}`];
    if (directByConfig) return directByConfig;

    const templateMatches = configsWithTemplate.filter((item) => item.template_id === template.id);
    const hasDuplicatesForTemplate = templateMatches.length > 1;
    if (hasDuplicatesForTemplate) return null;

    const direct = documentsByKey[`template:${template.id}`];
    if (direct) return direct;

    const legacyKey = template.system_key ? LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY[template.system_key] : null;
    if (!legacyKey) return null;

    return documentsByKey[`legacy:${legacyKey}`] || null;
  };

  const handleViewTemplateDocument = (config: JobDocumentConfigRecord) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template) {
      toast.error("Template not found");
      return;
    }

    const uploadedDocument = getUploadedDocumentForConfig(config);
    if (uploadedDocument) {
      openDocumentUrl(getUploadedDocumentUrl(uploadedDocument));
      return;
    }

    const fallbackText = getDocumentFallbackText({
      template,
      estimateAgreementTemplates,
      jobReleaseText,
      templateMergeFields,
    });

    if (fallbackText) {
      setPreview({
        title: template.name,
        content: fallbackText,
        fileName: template.name,
        requiresSignature: Boolean(config.requires_signature),
      });
      return;
    }

    toast.error("No document available yet");
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
        "id, lead_id, account_id, template_id, include_in_job, email_timing, requires_signature, sort_order, created_by, created_at, updated_at, template:document_templates(id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at)",
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

  const sendTemplateDocument = async (config: JobDocumentConfigRecord) => {
    const template = config.template || templateById[config.template_id] || null;
    if (!template || !leadId || !accountId || !userId) {
      toast.error("Missing document context");
      return false;
    }

    const fallbackText = getDocumentFallbackText({
      template,
      estimateAgreementTemplates,
      jobReleaseText,
      templateMergeFields,
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

      const { data: existingDocument, error: existingDocumentError } = await supabase
        .from("job_documents")
        .select("id")
        .eq("lead_id", leadId)
        .eq("config_id", config.id)
        .maybeSingle();

      if (existingDocumentError) {
        console.error("Failed to query existing job document:", existingDocumentError);
        toast.error("Failed to send document");
        return false;
      }

      if (existingDocument?.id) {
        const { error: updateError } = await supabase
          .from("job_documents")
          .update({
            file_name: fileName,
            file_path: filePath,
            mime_type: "application/pdf",
            uploaded_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDocument.id);

        if (updateError) {
          console.error("Failed to update job document:", updateError);
          toast.error("Failed to send document");
          return false;
        }
      } else {
        const { error: insertError } = await supabase
          .from("job_documents")
          .insert({
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
            uploaded_by: userId,
          });

        if (insertError) {
          console.error("Failed to insert job document:", insertError);
          toast.error("Failed to send document");
          return false;
        }
      }

      await fetchDocuments();
      toast.success("Document sent");
      return true;
    } finally {
      setSendingConfigId(null);
    }
  };

  const handleAddTemplate = async ({ sendImmediately }: { sendImmediately: boolean }) => {
    if (!selectedTemplate || addingTemplate) return;

    setAddingTemplate(true);
    try {
      const addedConfig = await addTemplateToJob(selectedTemplate);
      if (!addedConfig) return;

      if (sendImmediately) {
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
                  estimateAgreementTemplates,
                  jobReleaseText,
                  templateMergeFields,
                });
                const canView = Boolean(uploadedDocument || fallbackText);
                const isManualSend = config.email_timing === "manual";
                const canSendManual = isManualSend && !uploadedDocument;
                const isSending = sendingConfigId === config.id;
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
                          <p className={`text-sm ${uploadedDocument ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {uploadedDocument ? "Sent" : "Unsent"}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                          {canSendManual && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => void sendTemplateDocument(config)}
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
                            onClick={() => handleViewTemplateDocument(config)}
                            disabled={!canView || isRemoving}
                          >
                            <Eye className="h-4 w-4" />
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

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.title || "Document"}</DialogTitle>
            <DialogDescription className="sr-only">
              Document preview content
            </DialogDescription>
          </DialogHeader>
          <div
            className="prose prose-sm max-w-none leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-1 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-9 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/20 p-4"
            dangerouslySetInnerHTML={{
              __html: renderDocumentTemplateMarkdownHtml(preview?.content || "No document text available."),
            }}
          />
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="default"
              size="lg"
              aria-label="Download PDF"
              title="Download PDF"
              className="gap-2"
              onClick={() => {
                if (!preview) return;
                generateTemplateDocumentPDF({
                  title: preview.title,
                  fileName: preview.fileName,
                  content: preview.content,
                  requiresSignature: preview.requiresSignature,
                });
              }}
              disabled={!preview?.content?.trim()}
            >
              <Download className="h-5 w-5" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
