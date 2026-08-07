import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, DollarSign, X, Download, CircleAlert as AlertCircle } from "lucide-react";
import { generateEstimatePDF } from "@/lib/pdfGenerator";
import { normalizeClientPortalColor, normalizeClientPortalTextColor } from "@/lib/clientPortalTheme";
import {
  getDocumentFallbackText,
  renderDocumentTemplateMarkdownHtml,
  type DocumentTemplateMergeFields,
} from "@/lib/documentTemplates";
import { normalizeDocumentTemplateMergeFields } from "@/lib/documentTemplateMergeFields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  is_change_order?: boolean;
  change_order_type?: 'added' | 'edited' | 'deleted';
  change_order_approved?: boolean | null;
  changed_at?: string;
}

type PortalDocumentTemplate = {
  id: string;
  name: string;
  system_key: string | null;
  body: string | null;
};

type PortalJobDocumentConfig = {
  id: string;
  lead_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: string;
  requires_signature: boolean;
  sort_order: number;
  shared_at: string | null;
  template: PortalDocumentTemplate | null;
};

type PortalJobDocument = {
  id: string;
  lead_id: string;
  template_id: string | null;
  config_id: string | null;
  document_key: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
  url: string;
};

const LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY: Record<string, string> = {
  job_agreement: "job_agreement",
  warranty_agreement: "warranty",
  job_release: "job_release",
};

interface ClientPortalEstimateProps {
  estimate: {
    id?: string;
    job_id?: string | null;
    total: number;
    subtotal: number;
    profit_margin?: number;
    tax_rate: number;
    tax: number;
    discount: number;
    notes?: string;
    status: string;
    updated_at: string;
    line_items: LineItem[];
    original_total?: number | null;
    original_subtotal?: number | null;
    original_tax?: number | null;
    original_discount?: number | null;
    original_notes?: string | null;
    original_line_items?: LineItem[] | null;
    has_pending_changes?: boolean;
    estimate_versions?: Array<{
      id: string;
      name: string;
      subtotal: number;
      tax_rate: number;
      tax: number;
      discount: number;
      total: number;
      profit_margin?: number;
      notes?: string | null;
      line_items: LineItem[];
    }>;
    proposal_settings?: {
      sections?: Record<string, boolean>;
      title?: string | null;
      team_member_ids?: string[];
      highlight_line_item_ids?: string[];
      recommended_version_id?: string | null;
      latest_approved_snapshot?: {
        line_items?: LineItem[];
        subtotal?: number;
        tax_rate?: number;
        tax?: number;
        discount?: number;
        total?: number;
        captured_at?: string;
      } | null;
      payment_schedule?: {
        deposit_percentage?: number;
        midpoint_percentage?: number;
        final_percentage?: number;
      } | null;
      version_warranty_lengths?: Record<string, string> | null;
      version_warranty_enabled?: Record<string, boolean> | null;
    } | null;
    scope_of_work_items?: string[] | null;
    project_visualization_image_url?: string | null;
    agreement_acceptance?: Record<string, unknown> | null;
    approved_via?: string | null;
    accepted_at?: string | null;
    manual_approval_photo_url?: string | null;
    job_document_config_lead_id?: string | null;
    job_document_configs?: Array<{
      id: string;
      lead_id: string;
      template_id: string;
      include_in_job: boolean;
      email_timing: string;
      requires_signature: boolean;
      sort_order: number;
      shared_at?: string | null;
      template: {
        id: string;
        name: string;
        system_key: string | null;
        body: string | null;
      } | null;
    }>;
    job_documents?: Array<{
      id: string;
      lead_id: string;
      template_id: string | null;
      config_id: string | null;
      document_key: string;
      file_name: string;
      file_path: string;
      mime_type: string | null;
      created_at: string;
      url: string;
    }>;
    document_template_merge_fields?: Record<string, unknown> | null;
  };
  token: string;
  apiUrl: string;
  apiHeaders: Record<string, string>;
  onRefresh: () => void;
  jobId?: string | null;
  customerName?: string;
  jobName?: string;
  address?: string;
  companyName?: string;
  companyLogoUrl?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyDefaultPaymentSchedule?: Record<string, unknown> | null;
  createdAt?: string;
  expiresAt?: string;
  portalColor?: string;
  portalTextColor?: string;
}

function foldProfitMarginIntoLineItems(
  lineItems: LineItem[],
  subtotal: number,
  profitMargin: number,
): { lineItems: LineItem[]; subtotal: number } {
  const normalizedSubtotal = Number(subtotal) || 0;
  const marginRate = Number(profitMargin) / 100;
  if (marginRate <= 0 || lineItems.length === 0) {
    return { lineItems, subtotal: normalizedSubtotal };
  }

  const totalProfitCents = Math.round(normalizedSubtotal * marginRate * 100);
  if (totalProfitCents <= 0) {
    return { lineItems, subtotal: normalizedSubtotal };
  }

  const lineItemTotalCents = lineItems.map((item) => Math.round((Number(item.total) || 0) * 100));
  let eligibleIndexes = lineItemTotalCents
    .map((totalCents, index) => ({ index, totalCents }))
    .filter((entry) => entry.totalCents > 0)
    .map((entry) => entry.index);

  if (eligibleIndexes.length === 0) {
    eligibleIndexes = lineItems.map((_, index) => index);
  }

  if (eligibleIndexes.length === 0) {
    return { lineItems, subtotal: normalizedSubtotal };
  }

  const weightSum = eligibleIndexes.reduce((sum, index) => sum + Math.max(lineItemTotalCents[index], 1), 0);
  const distributedCentsByIndex = new Map<number, number>();
  const fractionalShares: Array<{ index: number; fractional: number }> = [];
  let distributedCents = 0;

  for (const index of eligibleIndexes) {
    const weight = Math.max(lineItemTotalCents[index], 1);
    const rawShare = (totalProfitCents * weight) / Math.max(weightSum, 1);
    const baseShare = Math.floor(rawShare);
    distributedCentsByIndex.set(index, baseShare);
    distributedCents += baseShare;
    fractionalShares.push({ index, fractional: rawShare - baseShare });
  }

  let remainder = totalProfitCents - distributedCents;
  fractionalShares
    .sort((a, b) => b.fractional - a.fractional || a.index - b.index)
    .forEach((entry) => {
      if (remainder <= 0) {
        return;
      }
      distributedCentsByIndex.set(entry.index, (distributedCentsByIndex.get(entry.index) || 0) + 1);
      remainder -= 1;
    });

  const adjustedLineItems = lineItems.map((item, index) => {
    const shareCents = distributedCentsByIndex.get(index) || 0;
    if (shareCents === 0) {
      return item;
    }

    const originalTotal = Number(item.total) || 0;
    const quantity = Number(item.quantity) || 0;
    const adjustedTotal = Number((originalTotal + shareCents / 100).toFixed(2));
    const adjustedUnitPrice = quantity > 0
      ? Number((adjustedTotal / quantity).toFixed(2))
      : Number(((Number(item.unit_price) || 0) + shareCents / 100).toFixed(2));

    return {
      ...item,
      total: adjustedTotal,
      unit_price: adjustedUnitPrice,
    };
  });

  return {
    lineItems: adjustedLineItems,
    subtotal: Number((normalizedSubtotal + totalProfitCents / 100).toFixed(2)),
  };
}

export function ClientPortalEstimate({
  estimate,
  token,
  apiUrl,
  apiHeaders,
  onRefresh,
  jobId = null,
  customerName = "Customer",
  jobName = "",
  address = "",
  companyName = "",
  companyLogoUrl = "",
  companyEmail = "",
  companyPhone = "",
  companyDefaultPaymentSchedule = null,
  createdAt,
  expiresAt,
  portalColor = "",
  portalTextColor = "",
}: ClientPortalEstimateProps) {
  const SIGNATURE_CANVAS_WIDTH = 600;
  const SIGNATURE_CANVAS_HEIGHT = 180;
  const versionWindowSize = 3;
  const [submitting, setSubmitting] = useState<"approve" | "decline" | "approve_changes" | "decline_changes" | "sign_document" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionWindowStart, setVersionWindowStart] = useState(0);
  const [hasSignature, setHasSignature] = useState(false);
  const [activeDocument, setActiveDocument] = useState<{ title: string; content: string } | null>(null);
  const [approvalDialogAction, setApprovalDialogAction] = useState<"approve" | "approve_changes" | null>(null);
  const [isSigningOutstandingDocuments, setIsSigningOutstandingDocuments] = useState(false);
  const [isVisualizationPortrait, setIsVisualizationPortrait] = useState(false);
  const [agreementChecks, setAgreementChecks] = useState<Record<string, boolean>>({});
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingSignatureRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const isPending = estimate.status !== "accepted" && estimate.status !== "declined";
  const hasPendingChanges = estimate.has_pending_changes === true;
  const shouldShowChangeOrderReview = hasPendingChanges;
  const availableVersions = useMemo(
    () => estimate.estimate_versions || [],
    [estimate.estimate_versions],
  );

  useEffect(() => {
    if (availableVersions.length === 0) {
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId((previous) => {
      if (previous && availableVersions.some((version) => version.id === previous)) {
        return previous;
      }
      return availableVersions[availableVersions.length - 1].id;
    });
  }, [availableVersions]);

  const selectedVersion = useMemo(
    () => availableVersions.find((version) => version.id === selectedVersionId) || null,
    [availableVersions, selectedVersionId],
  );
  const isWarrantyEnabledForVersion = useCallback((versionId: string | null) => {
    if (!versionId) return true;
    const warrantySettings = estimate?.proposal_settings?.version_warranty_enabled;
    const map =
      warrantySettings && typeof warrantySettings === "object"
        ? (warrantySettings as Record<string, unknown>)
        : {};
    const value = map[versionId];
    return value === undefined ? true : value === true;
  }, [estimate?.proposal_settings?.version_warranty_enabled]);
  const isWarrantyEnabledForCurrentSelection = useMemo(() => {
    const versionId =
      selectedVersionId ||
      estimate?.proposal_settings?.recommended_version_id ||
      availableVersions[0]?.id ||
      null;
    return isWarrantyEnabledForVersion(versionId);
  }, [availableVersions, estimate?.proposal_settings?.recommended_version_id, isWarrantyEnabledForVersion, selectedVersionId]);
  const hasPortalDocumentPayload = useMemo(
    () => Array.isArray(estimate.job_document_configs) || Array.isArray(estimate.job_documents),
    [estimate.job_document_configs, estimate.job_documents],
  );
  const normalizeEmailTimingValue = useCallback((value: unknown) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }, []);
  const portalDocumentConfigs = useMemo(
    () =>
      ((estimate.job_document_configs || []) as PortalJobDocumentConfig[])
        .filter((config) => Boolean(config?.id))
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [estimate.job_document_configs],
  );
  const portalDocuments = useMemo(
    () =>
      ((estimate.job_documents || []) as PortalJobDocument[])
        .filter((document) => Boolean(document?.id))
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
    [estimate.job_documents],
  );
  const effectivePortalDocumentConfigs = useMemo(() => {
    if (portalDocumentConfigs.length > 0) return portalDocumentConfigs;
    if (portalDocuments.length === 0) return [];

    const syntheticConfigs = new Map<string, PortalJobDocumentConfig>();
    for (let index = 0; index < portalDocuments.length; index += 1) {
      const document = portalDocuments[index];
      const templateId = String(document.template_id || "");
      const dedupeKey = templateId || `legacy:${String(document.document_key || document.id)}`;
      if (syntheticConfigs.has(dedupeKey)) continue;

      syntheticConfigs.set(dedupeKey, {
        id: `virtual:${dedupeKey}`,
        lead_id: String(document.lead_id || estimate.job_document_config_lead_id || ""),
        template_id: templateId,
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        sort_order: index,
        shared_at: document.created_at || null,
        template: {
          id: templateId,
          name: String(document.file_name || "Document"),
          system_key: null,
          body: null,
        },
      });
    }

    return Array.from(syntheticConfigs.values()).sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
    );
  }, [estimate.job_document_config_lead_id, portalDocumentConfigs, portalDocuments]);
  const maxVersionWindowStart = Math.max(availableVersions.length - versionWindowSize, 0);
  const visibleVersions = useMemo(
    () => availableVersions.slice(versionWindowStart, versionWindowStart + versionWindowSize),
    [availableVersions, versionWindowStart, versionWindowSize],
  );

  useEffect(() => {
    setVersionWindowStart((previous) => Math.min(previous, maxVersionWindowStart));
  }, [maxVersionWindowStart]);

  useEffect(() => {
    if (!selectedVersionId) {
      setVersionWindowStart(0);
      return;
    }

    const selectedIndex = availableVersions.findIndex((version) => version.id === selectedVersionId);
    if (selectedIndex === -1) {
      return;
    }

    setVersionWindowStart((previous) => {
      if (selectedIndex < previous) {
        return selectedIndex;
      }

      const currentWindowEnd = previous + versionWindowSize - 1;
      if (selectedIndex > currentWindowEnd) {
        return Math.min(selectedIndex - (versionWindowSize - 1), maxVersionWindowStart);
      }

      return previous;
    });
  }, [availableVersions, maxVersionWindowStart, selectedVersionId, versionWindowSize]);

  const currentLineItems = estimate.line_items.filter((item) =>
    !item.is_change_order || item.change_order_type !== 'deleted'
  );
  const latestApprovedSnapshot =
    estimate.proposal_settings?.latest_approved_snapshot &&
    typeof estimate.proposal_settings.latest_approved_snapshot === "object"
      ? estimate.proposal_settings.latest_approved_snapshot
      : null;

  const fallbackApprovedBaselineLineItems = useMemo(
    () =>
      estimate.line_items.filter((item) =>
        (!item.is_change_order || item.change_order_approved === true) && item.change_order_type !== "deleted"
      ),
    [estimate.line_items],
  );
  const hasOriginalSnapshotBaseline =
    Array.isArray(estimate.original_line_items) &&
    estimate.original_line_items.length > 0 &&
    typeof estimate.original_total === "number";
  const hasLatestApprovedSnapshotBaseline =
    Array.isArray(latestApprovedSnapshot?.line_items) &&
    latestApprovedSnapshot.line_items.length > 0 &&
    typeof latestApprovedSnapshot.total === "number";
  const mostRecentApprovedBaselineLineItems = hasLatestApprovedSnapshotBaseline
    ? latestApprovedSnapshot!.line_items!
    : hasOriginalSnapshotBaseline
    ? estimate.original_line_items!
    : fallbackApprovedBaselineLineItems;
  const approvedBaselineSubtotal = hasLatestApprovedSnapshotBaseline
    ? Number(latestApprovedSnapshot?.subtotal || 0)
    : hasOriginalSnapshotBaseline
    ? Number(estimate.original_subtotal || 0)
    : fallbackApprovedBaselineLineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const approvedBaselineTax = hasLatestApprovedSnapshotBaseline
    ? Number(latestApprovedSnapshot?.tax || 0)
    : hasOriginalSnapshotBaseline
    ? Number(estimate.original_tax || 0)
    : approvedBaselineSubtotal * Number(estimate.tax_rate || 0);
  const approvedBaselineDiscount = hasLatestApprovedSnapshotBaseline
    ? Number(latestApprovedSnapshot?.discount || 0)
    : hasOriginalSnapshotBaseline
    ? Number(estimate.original_discount || 0)
    : Number(estimate.discount || 0);
  const approvedBaselineTotal = hasLatestApprovedSnapshotBaseline
    ? Number(latestApprovedSnapshot?.total || 0)
    : hasOriginalSnapshotBaseline
    ? Number(estimate.original_total || 0)
    : approvedBaselineSubtotal + approvedBaselineTax - approvedBaselineDiscount;
  const hasApprovedBaselineEstimate = mostRecentApprovedBaselineLineItems.length > 0;

  const displayLineItems = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.line_items
    : currentLineItems;
  const displaySubtotal = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.subtotal
    : estimate.subtotal;
  const displayTax = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.tax
    : estimate.tax;
  const displayDiscount = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.discount
    : estimate.discount;
  const displayTotal = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.total
    : estimate.total;
  const displayNotes = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.notes
    : estimate.notes;
  const displayProfitMargin = isPending && !hasPendingChanges && selectedVersion
    ? Number(selectedVersion.profit_margin || 0)
    : Number(estimate.profit_margin || 0);
  const displayTaxRate = isPending && !hasPendingChanges && selectedVersion
    ? Number(selectedVersion.tax_rate || estimate.tax_rate)
    : Number(estimate.tax_rate);
  const normalizedPortalColor = normalizeClientPortalColor(portalColor);
  const normalizedPortalTextColor = normalizeClientPortalTextColor(portalTextColor);
  const isVersionComparisonMode = isPending && !hasPendingChanges && availableVersions.length > 0;
  const displayEstimateWithProfitFolded = useMemo(
    () => foldProfitMarginIntoLineItems(displayLineItems, Number(displaySubtotal), displayProfitMargin),
    [displayLineItems, displayProfitMargin, displaySubtotal],
  );
  const changeOrderDelta = hasApprovedBaselineEstimate
    ? Number(estimate.total || 0) - Number(approvedBaselineTotal || 0)
    : null;
  const displayLineItemsWithProfitFolded = displayEstimateWithProfitFolded.lineItems;
  const displaySubtotalWithProfitFolded = displayEstimateWithProfitFolded.subtotal;
  const proposalSections = estimate.proposal_settings?.sections || {};
  const highlightedLineItemIds = new Set(estimate.proposal_settings?.highlight_line_item_ids || []);
  const highlightedItems = displayLineItems.filter((item) => highlightedLineItemIds.has(item.id));
  const mergeFields = useMemo((): DocumentTemplateMergeFields => {
    return normalizeDocumentTemplateMergeFields(estimate.document_template_merge_fields);
  }, [estimate.document_template_merge_fields]);
  const getUploadedDocumentForConfig = useCallback((config: PortalJobDocumentConfig) => {
    const directByConfig = portalDocuments.find((document) => document.config_id === config.id);
    if (directByConfig) return directByConfig;

    const templateId = config.template?.id || config.template_id;
    if (!templateId) return null;
    const hasDuplicateTemplateConfigs = effectivePortalDocumentConfigs.filter((row) => row.template_id === templateId).length > 1;
    if (!hasDuplicateTemplateConfigs) {
      const directByTemplate = portalDocuments.find((document) => document.template_id === templateId);
      if (directByTemplate) return directByTemplate;
    }

    const systemKey = config.template?.system_key ? String(config.template.system_key) : "";
    const legacyKey = systemKey ? LEGACY_DOCUMENT_KEY_BY_SYSTEM_KEY[systemKey] : "";
    if (legacyKey) {
      return portalDocuments.find((document) => String(document.document_key || "") === legacyKey) || null;
    }

    return null;
  }, [effectivePortalDocumentConfigs, portalDocuments]);
  const approvalRequiredDocuments = useMemo(
    () =>
      effectivePortalDocumentConfigs.filter(
        (config) => {
          const timing = normalizeEmailTimingValue(config.email_timing);
          return Boolean(config.include_in_job)
            && timing === "on_estimate_approval"
            && config.requires_signature === true
            && (config.template?.system_key !== "warranty_agreement" || isWarrantyEnabledForCurrentSelection);
        },
      ),
    [effectivePortalDocumentConfigs, isWarrantyEnabledForCurrentSelection, normalizeEmailTimingValue],
  );
  const manuallySentDocuments = useMemo(
    () =>
      effectivePortalDocumentConfigs.filter(
        (config) => {
          const timing = normalizeEmailTimingValue(config.email_timing);
          return Boolean(config.include_in_job)
            && timing === "manual"
            && config.requires_signature === true
            && Boolean(config.shared_at);
        },
      ),
    [effectivePortalDocumentConfigs, normalizeEmailTimingValue],
  );
  const visiblePortalDocuments = useMemo(() => {
    if (approvalRequiredDocuments.length === 0 && manuallySentDocuments.length === 0) return [];
    const byId = new Map<string, PortalJobDocumentConfig>();
    for (const config of approvalRequiredDocuments) byId.set(config.id, config);
    for (const config of manuallySentDocuments) byId.set(config.id, config);
    return Array.from(byId.values()).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }, [approvalRequiredDocuments, manuallySentDocuments]);
  const manuallySentDocumentConfigIds = useMemo(
    () => new Set(manuallySentDocuments.map((config) => String(config.id))),
    [manuallySentDocuments],
  );
  const signedDocumentConfigIds = useMemo(() => {
    const acceptanceRaw =
      estimate.agreement_acceptance && typeof estimate.agreement_acceptance === "object"
        ? (estimate.agreement_acceptance as Record<string, unknown>)
        : {};
    return new Set(
      Object.entries(acceptanceRaw)
        .filter(([key, value]) => key.length > 0 && value === true)
        .map(([key]) => key),
    );
  }, [estimate.agreement_acceptance]);
  const unsignedManualDocuments = useMemo(
    () => manuallySentDocuments.filter((config) => !signedDocumentConfigIds.has(String(config.id))),
    [manuallySentDocuments, signedDocumentConfigIds],
  );
  const documentDisplayNameByConfigId = useMemo(() => {
    const displayNameById = new Map<string, string>();
    const occurrenceByTemplateId = new Map<string, number>();
    const orderedConfigs = [...effectivePortalDocumentConfigs].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
    );

    for (const config of orderedConfigs) {
      const templateId = String(config.template?.id || config.template_id || "");
      const baseName = String(config.template?.name || "Document");
      if (!templateId) {
        displayNameById.set(config.id, baseName);
        continue;
      }

      const nextOccurrence = (occurrenceByTemplateId.get(templateId) || 0) + 1;
      occurrenceByTemplateId.set(templateId, nextOccurrence);
      const displayName = nextOccurrence > 1 ? `${baseName} #${nextOccurrence}` : baseName;
      displayNameById.set(config.id, displayName);
    }

    return displayNameById;
  }, [effectivePortalDocumentConfigs]);
  const getConfigDocumentDisplayName = useCallback(
    (config: PortalJobDocumentConfig) =>
      documentDisplayNameByConfigId.get(config.id) || String(config.template?.name || "Document"),
    [documentDisplayNameByConfigId],
  );
  const approvalCheckboxItems = useMemo(() => {
    if (!hasPortalDocumentPayload) return [];

    return approvalRequiredDocuments.map((config) => ({
      id: config.id,
      title: String(config.template?.name || "Document"),
      config,
    }));
  }, [approvalRequiredDocuments, hasPortalDocumentPayload]);
  useEffect(() => {
    setAgreementChecks((previous) => {
      const next: Record<string, boolean> = {};
      for (const item of approvalCheckboxItems) {
        next[item.id] = previous[item.id] ?? true;
      }
      return next;
    });
  }, [approvalCheckboxItems]);
  const hasAcceptedAllRequiredDocuments = useMemo(
    () => approvalCheckboxItems.every((item) => agreementChecks[item.id] === true),
    [agreementChecks, approvalCheckboxItems],
  );
  const approvedChangeOrderEntries = useMemo(
    () => estimate.line_items.filter((item) => item.is_change_order === true && item.change_order_approved === true),
    [estimate.line_items],
  );
  const mostRecentApprovedChangeOrder = useMemo(() => {
    if (approvedChangeOrderEntries.length === 0) return null;

    const entriesWithChangedAt = approvedChangeOrderEntries.filter((item) => Boolean(item.changed_at));
    if (entriesWithChangedAt.length === 0) {
      return {
        changedAt: null as string | null,
        items: approvedChangeOrderEntries,
      };
    }

    let latestTimestamp = entriesWithChangedAt[0].changed_at as string;
    for (const item of entriesWithChangedAt) {
      if ((item.changed_at as string) > latestTimestamp) latestTimestamp = item.changed_at as string;
    }

    return {
      changedAt: latestTimestamp,
      items: approvedChangeOrderEntries.filter((item) => item.changed_at === latestTimestamp),
    };
  }, [approvedChangeOrderEntries]);

  const getSignatureContext = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;

    try {
      return canvas.getContext("2d");
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const context = getSignatureContext();
    if (!context) return;

    context.clearRect(0, 0, SIGNATURE_CANVAS_WIDTH, SIGNATURE_CANVAS_HEIGHT);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
  }, [SIGNATURE_CANVAS_HEIGHT, SIGNATURE_CANVAS_WIDTH]);

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = getSignatureContext();
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
    isDrawingSignatureRef.current = false;
    lastPointRef.current = null;
    setHasSignature(false);
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;

    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;

    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    };
  };

  const drawSignatureSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const context = getSignatureContext();
    if (!context) return;

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.closePath();
  };

  const handleSignaturePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    if (!point) return;

    isDrawingSignatureRef.current = true;
    lastPointRef.current = point;
    drawSignatureSegment(point, point);
    setHasSignature(true);

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleSignaturePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignatureRef.current) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    const lastPoint = lastPointRef.current || point;
    drawSignatureSegment(lastPoint, point);
    lastPointRef.current = point;
    setHasSignature(true);
    event.preventDefault();
  };

  const handleSignaturePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingSignatureRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
  };

  const getSignatureDataUrl = () => {
    if (!hasSignature) {
      return null;
    }

    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return null;
    }

    return canvas.toDataURL("image/png");
  };

  const getSignaturePayloadFields = () => {
    const signatureDataUrl = getSignatureDataUrl();
    if (!signatureDataUrl) {
      return {};
    }

    // Keep both key styles for backward/forward compatibility with edge-function payload parsing.
    return {
      signature_data_url: signatureDataUrl,
      signatureDataUrl: signatureDataUrl,
    };
  };

  const handleDownloadPDF = async () => {
    await generateEstimatePDF({
      customerName,
      jobName,
      address,
      companyName,
      companyLogoUrl,
      companyEmail,
      companyPhone,
      lineItems: displayLineItemsWithProfitFolded,
      subtotal: displaySubtotalWithProfitFolded,
      taxRate: displayTaxRate,
      tax: displayTax,
      discount: displayDiscount,
      total: displayTotal,
      notes: displayNotes || undefined,
      createdAt,
      expiresAt,
    });
  };

  const resolveConfigDocumentText = useCallback((config: PortalJobDocumentConfig) => {
    const template = config.template;
    if (!template) return "";
    return getDocumentFallbackText({
      template,
      jobReleaseText: null,
      templateMergeFields: mergeFields,
    });
  }, [mergeFields]);

  const openDocumentFromConfig = useCallback((config: PortalJobDocumentConfig) => {
    const title = getConfigDocumentDisplayName(config);
    const uploadedDocument = getUploadedDocumentForConfig(config);
    if (uploadedDocument?.url) {
      window.open(uploadedDocument.url, "_blank", "noopener,noreferrer");
      return;
    }

    const content = resolveConfigDocumentText(config);
    setActiveDocument({
      title,
      content: content || "No document text available for this document.",
    });
  }, [getConfigDocumentDisplayName, getUploadedDocumentForConfig, resolveConfigDocumentText]);

  const handleAction = async (action: "approve" | "decline") => {
    if (action === "approve") {
      if (!hasAcceptedAllRequiredDocuments) {
        setError("Please accept all required documents before approving.");
        return false;
      }
    }

    setSubmitting(action);
    setError(null);
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;
      const response = await fetch(url, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action,
          updated_at: estimate.updated_at,
          estimate_version_id: action === "approve" ? selectedVersionId : undefined,
          agreement_acceptance: action === "approve"
            ? {
                ...Object.fromEntries(
                  approvalCheckboxItems.map((item) => [item.id, agreementChecks[item.id] === true]),
                ),
              }
            : undefined,
          ...(action === "approve" ? getSignaturePayloadFields() : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong");
        return false;
      }

      onRefresh();
      return true;
    } catch {
      setError("Unable to connect. Please try again.");
      return false;
    } finally {
      setSubmitting(null);
    }
  };

  const handleChangeOrderAction = async (action: "approve_changes" | "decline_changes") => {
    setSubmitting(action);
    setError(null);
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;
      const response = await fetch(url, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action,
          updated_at: estimate.updated_at,
          ...(action === "approve_changes" ? getSignaturePayloadFields() : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong");
        return false;
      }

      onRefresh();
      return true;
    } catch {
      setError("Unable to connect. Please try again.");
      return false;
    } finally {
      setSubmitting(null);
    }
  };

  const openApprovalDialog = (action: "approve" | "approve_changes") => {
    clearSignature();
    setError(null);
    setActiveDocument(null);
    setAgreementChecks(
      approvalCheckboxItems.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {} as Record<string, boolean>),
    );
    setApprovalDialogAction(action);
  };

  const closeApprovalDialog = (open: boolean) => {
    if (!open) {
      setApprovalDialogAction(null);
      clearSignature();
    }
  };

  const handleConfirmApproval = async () => {
    if (approvalDialogAction === "approve") {
      const didSucceed = await handleAction("approve");
      if (didSucceed) {
        setApprovalDialogAction(null);
        clearSignature();
      }
      return;
    }

    if (approvalDialogAction === "approve_changes") {
      const didSucceed = await handleChangeOrderAction("approve_changes");
      if (didSucceed) {
        setApprovalDialogAction(null);
        clearSignature();
      }
    }
  };

  const handleSignManualDocuments = async () => {
    if (unsignedManualDocuments.length === 0) return;
    const signaturePayload = getSignaturePayloadFields();
    if (!signaturePayload.signature_data_url && !signaturePayload.signatureDataUrl) {
      setError("Please add your signature before submitting.");
      return;
    }

    setSubmitting("sign_document");
    setError(null);
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;
      const documentConfigIds = unsignedManualDocuments.map((config) => config.id);
      const documentKeys = unsignedManualDocuments
        .map((config) => getUploadedDocumentForConfig(config)?.document_key)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const response = await fetch(url, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action: "sign_documents",
          document_config_ids: documentConfigIds,
          document_keys: documentKeys,
          updated_at: estimate.updated_at,
          ...signaturePayload,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = String((result as { error?: unknown })?.error || "Failed to sign document");
        const shouldTryLegacyFallback = response.status === 400 || response.status === 404 || response.status === 405;
        if (!shouldTryLegacyFallback) {
          setError(errorMessage);
          return;
        }

        // Legacy fallback for older deployed edge functions that only support sign_document.
        let latestUpdatedAt = estimate.updated_at;
        for (const config of unsignedManualDocuments) {
          const legacyDocumentKey = getUploadedDocumentForConfig(config)?.document_key;
          const legacyResponse = await fetch(url, {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({
              action: "sign_document",
              document_config_id: config.id,
              ...(legacyDocumentKey ? { document_key: legacyDocumentKey } : {}),
              updated_at: latestUpdatedAt,
              ...signaturePayload,
            }),
          });
          const legacyResult = await legacyResponse.json().catch(() => ({}));
          if (!legacyResponse.ok) {
            setError(String((legacyResult as { error?: unknown })?.error || "Failed to sign document"));
            return;
          }

          // Refresh updated_at between legacy calls to avoid optimistic-lock conflicts.
          const latestPortalResponse = await fetch(url, {
            method: "GET",
            headers: apiHeaders,
          });
          const latestPortalPayload = await latestPortalResponse.json().catch(() => ({}));
          const nextUpdatedAt = String((latestPortalPayload as { estimate?: { updated_at?: unknown } })?.estimate?.updated_at || "");
          if (nextUpdatedAt) latestUpdatedAt = nextUpdatedAt;
        }
      }
      setIsSigningOutstandingDocuments(false);
      clearSignature();
      onRefresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };


  const renderComparisonCard = (
    title: string,
    lineItems: LineItem[],
    subtotal: number,
    taxRate: number,
    profitMargin: number,
    tax: number,
    discount: number,
    total: number,
    options?: {
      highlighted?: boolean;
    }
  ) => {
    const adjustedEstimate = foldProfitMarginIntoLineItems(lineItems, subtotal, profitMargin);
    const isHighlighted = options?.highlighted === true;

    return (
      <div
        className={[
          "rounded-2xl border overflow-hidden",
          isHighlighted ? "shadow-md" : "border-slate-200 bg-white text-slate-700",
        ].join(" ")}
        style={isHighlighted ? { backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor, borderColor: normalizedPortalColor } : undefined}
      >
        <div className={isHighlighted ? "px-4 py-3 border-b border-white/25" : "px-4 py-3 border-b border-slate-200"}>
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className={isHighlighted ? "text-2xl font-bold mt-1 tracking-tight" : "text-2xl font-bold mt-1 tracking-tight text-slate-900"}>
            ${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {adjustedEstimate.lineItems.length > 0 ? (
              adjustedEstimate.lineItems.map((item, itemIndex) => (
                <div
                  key={`comparison-line-item-${item.id || "missing"}-${itemIndex}`}
                  className={isHighlighted ? "pb-2 border-b border-white/20 last:border-b-0 last:pb-0" : "pb-2 border-b border-slate-100 last:border-b-0 last:pb-0"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={isHighlighted ? "text-sm font-medium leading-tight" : "text-sm font-medium text-slate-900 leading-tight"}>
                        {item.name}
                      </p>
                      <p className={isHighlighted ? "text-xs mt-0.5 opacity-85" : "text-xs text-slate-500 mt-0.5"}>
                        {item.quantity} {item.unit} x ${Number(item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <p className={isHighlighted ? "text-sm font-semibold whitespace-nowrap" : "text-sm font-semibold text-slate-900 whitespace-nowrap"}>
                      ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className={isHighlighted ? "text-xs opacity-85" : "text-xs text-slate-500"}>
                No line items.
              </p>
            )}
          </div>

          <div className={isHighlighted ? "pt-2 border-t border-white/30 space-y-1.5" : "pt-2 border-t border-slate-200 space-y-1.5"}>
            <div className="flex justify-between text-xs">
              <span className={isHighlighted ? "opacity-85" : "text-slate-500"}>Subtotal</span>
              <span className={isHighlighted ? "font-medium" : "text-slate-700 font-medium"}>
                ${Number(adjustedEstimate.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={isHighlighted ? "opacity-85" : "text-slate-500"}>
                Tax ({(Number(taxRate) * 100).toFixed(1)}%)
              </span>
              <span className={isHighlighted ? "font-medium" : "text-slate-700 font-medium"}>
                ${Number(tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between text-xs">
                <span className={isHighlighted ? "opacity-85" : "text-slate-500"}>Discount</span>
                <span className={isHighlighted ? "font-medium" : "text-emerald-600 font-medium"}>
                  -${Number(discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className={isHighlighted ? "flex justify-between text-sm font-bold pt-1" : "flex justify-between text-sm font-bold text-slate-900 pt-1"}>
              <span>Total</span>
              <span>${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const signaturePad = (
    <div className="mb-1">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">E-signature (required)</p>
          <p className="text-xs text-slate-500">
            Sign with your finger on mobile, or click and drag on desktop.
          </p>
        </div>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!hasSignature || submitting !== null}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={signatureCanvasRef}
        width={SIGNATURE_CANVAS_WIDTH}
        height={SIGNATURE_CANVAS_HEIGHT}
        onPointerDown={handleSignaturePointerDown}
        onPointerMove={handleSignaturePointerMove}
        onPointerUp={handleSignaturePointerUp}
        onPointerCancel={handleSignaturePointerUp}
        onPointerLeave={handleSignaturePointerUp}
        className="h-40 w-full rounded-lg border border-slate-200 bg-white touch-none"
        aria-label="Signature pad"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
          {estimate.status === "accepted" && !hasPendingChanges && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Approved
            </span>
          )}
          {estimate.status === "accepted" && hasPendingChanges && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Changes Pending
            </span>
          )}
          {estimate.status === "declined" && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              Declined
            </span>
          )}
        </div>

        {!isVersionComparisonMode && (
          <button
            onClick={handleDownloadPDF}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        )}
        {isVersionComparisonMode && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Choose Option
              </label>
              {availableVersions.length > versionWindowSize && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous options"
                    onClick={() => setVersionWindowStart((previous) => Math.max(previous - 1, 0))}
                    disabled={versionWindowStart === 0}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {versionWindowStart + 1}-{Math.min(versionWindowStart + versionWindowSize, availableVersions.length)} of {availableVersions.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next options"
                    onClick={() => setVersionWindowStart((previous) => Math.min(previous + 1, maxVersionWindowStart))}
                    disabled={versionWindowStart >= maxVersionWindowStart}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {visibleVersions.map((version) => {
                const isSelectedVersion = selectedVersionId === version.id;
                const versionWithProfitFolded = foldProfitMarginIntoLineItems(
                  version.line_items,
                  Number(version.subtotal),
                  Number(version.profit_margin || 0),
                );

                return (
                  <div key={version.id} className="w-full max-w-2xl flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVersionId(version.id)}
                      aria-pressed={isSelectedVersion}
                      className={[
                        "w-full rounded-2xl border text-left transition-all overflow-hidden",
                        isSelectedVersion
                          ? "shadow-md"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm",
                      ].join(" ")}
                      style={isSelectedVersion ? { backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor, borderColor: normalizedPortalColor } : undefined}
                    >
                      <div className={isSelectedVersion ? "px-4 py-3 border-b border-white/25" : "px-4 py-3 border-b border-slate-200"}>
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{version.name}</p>
                          {isSelectedVersion && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDownloadPDF();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDownloadPDF();
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </span>
                          )}
                        </div>
                        <p className={isSelectedVersion ? "text-2xl font-bold mt-1 tracking-tight" : "text-2xl font-bold mt-1 tracking-tight text-slate-900"}>
                          ${Number(version.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {versionWithProfitFolded.lineItems.length > 0 ? (
                            versionWithProfitFolded.lineItems.map((item, itemIndex) => (
                              <div
                                key={`version-line-item-${version.id}-${item.id || "missing"}-${itemIndex}`}
                                className={isSelectedVersion ? "pb-2 border-b border-white/20 last:border-b-0 last:pb-0" : "pb-2 border-b border-slate-100 last:border-b-0 last:pb-0"}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className={isSelectedVersion ? "text-sm font-medium leading-tight" : "text-sm font-medium text-slate-900 leading-tight"}>
                                      {item.name}
                                    </p>
                                    <p className={isSelectedVersion ? "text-xs mt-0.5 opacity-85" : "text-xs text-slate-500 mt-0.5"}>
                                      {item.quantity} {item.unit} x ${Number(item.unit_price).toFixed(2)}
                                    </p>
                                  </div>
                                  <p className={isSelectedVersion ? "text-sm font-semibold whitespace-nowrap" : "text-sm font-semibold text-slate-900 whitespace-nowrap"}>
                                    ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className={isSelectedVersion ? "text-xs opacity-85" : "text-xs text-slate-500"}>
                              No line items.
                            </p>
                          )}
                        </div>

                        <div className={isSelectedVersion ? "pt-2 border-t border-white/30 space-y-1.5" : "pt-2 border-t border-slate-200 space-y-1.5"}>
                          <div className="flex justify-between text-xs">
                            <span className={isSelectedVersion ? "opacity-85" : "text-slate-500"}>Subtotal</span>
                            <span className={isSelectedVersion ? "font-medium" : "text-slate-700 font-medium"}>
                              ${versionWithProfitFolded.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className={isSelectedVersion ? "opacity-85" : "text-slate-500"}>
                              Tax ({(Number(version.tax_rate) * 100).toFixed(1)}%)
                            </span>
                            <span className={isSelectedVersion ? "font-medium" : "text-slate-700 font-medium"}>
                              ${Number(version.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {Number(version.discount) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className={isSelectedVersion ? "opacity-85" : "text-slate-500"}>Discount</span>
                              <span className={isSelectedVersion ? "font-medium" : "text-emerald-600 font-medium"}>
                                -${Number(version.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div className={isSelectedVersion ? "flex justify-between text-sm font-bold pt-1" : "flex justify-between text-sm font-bold text-slate-900 pt-1"}>
                            <span>Total</span>
                            <span>${Number(version.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className={isSelectedVersion ? "pt-2" : "pt-2"}>
                          <span
                            className={`inline-flex w-full items-center justify-center rounded-lg border px-4 py-3 text-base font-bold ${
                              isSelectedVersion
                                ? "border-white/50 bg-white/15 text-white"
                                : "border-slate-300 bg-white text-slate-900"
                            }`}
                          >
                            {isSelectedVersion ? "Selected" : "Select"}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {shouldShowChangeOrderReview ? (
        <div className="px-6 sm:px-8 py-5">
          <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Changes Requiring Approval
              </p>
              <p className="text-xs text-amber-700 mt-1">
                The contractor has proposed changes to your most recent approved estimate. Please review both versions below.
              </p>
              {changeOrderDelta !== null && (
                <p className="text-xs text-amber-800 mt-1 font-semibold">
                  Change Order Total: {changeOrderDelta >= 0 ? "+" : "-"}$
                  {Math.abs(changeOrderDelta).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hasApprovedBaselineEstimate
              ? renderComparisonCard(
                  "Most Recent Approved Estimate",
                  mostRecentApprovedBaselineLineItems,
                  approvedBaselineSubtotal,
                  estimate.tax_rate,
                  estimate.profit_margin || 0,
                  approvedBaselineTax,
                  approvedBaselineDiscount,
                  approvedBaselineTotal,
                )
              : renderComparisonCard(
                  "Current Estimate",
                  currentLineItems,
                  estimate.subtotal,
                  estimate.tax_rate,
                  estimate.profit_margin || 0,
                  estimate.tax,
                  estimate.discount,
                  estimate.total,
                )}

            {renderComparisonCard(
              hasApprovedBaselineEstimate ? "Proposed Changes" : "Proposed Changes (Awaiting Approval)",
              currentLineItems,
              estimate.subtotal,
              estimate.tax_rate,
              estimate.profit_margin || 0,
              estimate.tax,
              estimate.discount,
              estimate.total,
              { highlighted: true }
            )}
          </div>

          <div className="mt-4">
            {error && (
              <p className="text-sm text-red-600 mb-3 text-center">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleChangeOrderAction("decline_changes")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === "decline_changes" ? (
                  <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {submitting === "decline_changes" ? "Declining..." : "Decline Changes"}
              </button>
              <button
                onClick={() => openApprovalDialog("approve_changes")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
              >
                <Check className="h-4 w-4" />
                Approve Changes
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {(proposalSections.materials ?? true) && highlightedItems.length > 0 && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Material Highlights
              </p>
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                {highlightedItems.map((item, itemIndex) => (
                  <div key={`highlighted-item-${item.id || "missing"}-${itemIndex}`} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-900">
                      ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(proposalSections.project_visualization ?? true) && estimate.project_visualization_image_url && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Project Visualization
              </p>
              <img
                src={estimate.project_visualization_image_url}
                alt="Project visualization"
                className={`w-full rounded-xl border border-slate-200 ${isVisualizationPortrait ? "max-h-[70vh] bg-slate-50 p-2 object-contain" : "object-cover"}`}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  setIsVisualizationPortrait(naturalHeight > naturalWidth);
                }}
              />
            </div>
          )}

          {!isVersionComparisonMode && displayLineItems.length > 0 && (
            <div className="px-6 sm:px-8 py-5">
              <div className="space-y-0">
                {displayLineItemsWithProfitFolded.map((item, itemIndex) => (
                  <div key={`display-line-item-${item.id || "missing"}-${itemIndex}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-slate-500 mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <p className="text-sm text-slate-400 mt-0.5">
                          {item.quantity} {item.unit} x $
                          {Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900 whitespace-nowrap">
                        $
                        {Number(item.total).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isVersionComparisonMode && (
            <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Subtotal
                  </span>
                  <span className="text-slate-700">
                    $
                    {Number(displaySubtotalWithProfitFolded).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Tax ({(Number(displayTaxRate) * 100).toFixed(1)}%)
                  </span>
                  <span className="text-slate-700">
                    $
                    {Number(displayTax).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {Number(displayDiscount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-emerald-600">
                      -$
                      {Number(displayDiscount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <span className="text-lg font-bold text-slate-900">Total</span>
                  <span className="text-lg font-bold text-slate-900">
                    $
                    {Number(displayTotal).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isVersionComparisonMode && displayNotes && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Notes
              </p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {displayNotes}
              </p>
            </div>
          )}

        </>
      )}

      {hasPortalDocumentPayload && unsignedManualDocuments.length > 0 && (
        <div className="px-6 sm:px-8 py-5 border-t border-amber-200 bg-amber-50/70">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">
            Outstanding Documents
          </p>
          <div className="space-y-2">
            {unsignedManualDocuments.map((config, index) => (
              <div
                key={`outstanding-document-${config.id || "missing"}-${index}`}
                className="rounded-md border border-amber-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm text-slate-800">{getConfigDocumentDisplayName(config)}</span>
                  <button
                    type="button"
                    onClick={() => openDocumentFromConfig(config)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View Document
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              clearSignature();
              setIsSigningOutstandingDocuments(true);
            }}
            className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
          >
            Sign Outstanding Documents ({unsignedManualDocuments.length})
          </button>
        </div>
      )}

      <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          Documents
        </p>
        <div className="space-y-3">
          {!hasPortalDocumentPayload && (
            <p className="text-sm text-slate-600">
              Document configuration is unavailable in this portal response. Refresh after the latest portal backend is deployed.
            </p>
          )}
          {hasPortalDocumentPayload && visiblePortalDocuments.map((config, index) => (
            <div
              key={`portal-document-${config.id || "missing"}-${config.template_id || "template"}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3"
            >
              <p className="text-sm font-semibold text-slate-900">
                {getConfigDocumentDisplayName(config)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDocumentFromConfig(config)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  View Document
                </button>
                {manuallySentDocumentConfigIds.has(String(config.id)) && (
                  signedDocumentConfigIds.has(String(config.id)) ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Signed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Signature Needed
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
          {hasPortalDocumentPayload && visiblePortalDocuments.length === 0 && (
            <p className="text-sm text-slate-600">No approval or manually sent documents are available yet.</p>
          )}
          {!isPending && (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Original Estimate</p>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDocument({
                      title: "Original Estimate",
                      content: buildOriginalEstimateDocumentText({
                        lineItems:
                          Array.isArray(estimate.original_line_items) && estimate.original_line_items.length > 0
                            ? estimate.original_line_items
                            : mostRecentApprovedBaselineLineItems,
                        subtotal:
                          typeof estimate.original_subtotal === "number"
                            ? estimate.original_subtotal
                            : approvedBaselineSubtotal,
                        tax:
                          typeof estimate.original_tax === "number"
                            ? estimate.original_tax
                            : approvedBaselineTax,
                        discount:
                          typeof estimate.original_discount === "number"
                            ? estimate.original_discount
                            : approvedBaselineDiscount,
                        total:
                          typeof estimate.original_total === "number"
                            ? estimate.original_total
                            : approvedBaselineTotal,
                        taxRate: Number(estimate.tax_rate || 0),
                      }),
                    })}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  View Document
                </button>
              </div>
              {mostRecentApprovedChangeOrder && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Most Recent Approved Change Order
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDocument({
                        title: "Most Recent Approved Change Order",
                        content: buildApprovedChangeOrderDocumentText({
                          changedAt: mostRecentApprovedChangeOrder.changedAt,
                          items: mostRecentApprovedChangeOrder.items,
                          approvedVia: estimate.approved_via || null,
                          approvedAt: estimate.accepted_at || null,
                          hasSignature: Boolean(estimate.manual_approval_photo_url),
                          total: Number(estimate.total || 0),
                        }),
                      })}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View Document
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isPending && !hasPendingChanges && (
        <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
          {error && (
            <p className="text-sm text-red-600 mb-3 text-center">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("decline")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting === "decline" ? (
                <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {submitting === "decline" ? "Declining..." : "Decline"}
            </button>
            <button
              onClick={() => openApprovalDialog("approve")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
            >
              <Check className="h-4 w-4" />
              Approve
            </button>
          </div>
        </div>
      )}

      <Dialog open={approvalDialogAction !== null} onOpenChange={closeApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialogAction === "approve_changes" ? "Approve Changes" : "Approve Estimate"}
            </DialogTitle>
            <DialogDescription>
              Add your e-signature, then submit your approval.
            </DialogDescription>
          </DialogHeader>
          {signaturePad}
          {approvalDialogAction === "approve" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">Required documents</p>
              {approvalCheckboxItems.map((item, index) => (
                <div key={`approval-item-${item.id || "missing"}-${index}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={agreementChecks[item.id] === true}
                        onChange={(event) =>
                          setAgreementChecks((previous) => ({ ...previous, [item.id]: event.target.checked }))
                        }
                      />
                      <span className="font-medium">{item.title}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.config) {
                          openDocumentFromConfig(item.config);
                          return;
                        }
                        setActiveDocument({
                          title: item.title,
                          content: "No document text available for this document.",
                        });
                      }}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      View Document
                    </button>
                  </div>
                </div>
              ))}
              {approvalCheckboxItems.length === 0 && (
                <p className="text-xs text-slate-600">
                  {hasPortalDocumentPayload
                    ? "No estimate-approval documents are configured."
                    : "Document configuration is unavailable in this portal response."}
                </p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => closeApprovalDialog(false)}
              disabled={submitting !== null}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmApproval}
              disabled={
                submitting !== null
                || !hasSignature
                || (approvalDialogAction === "approve" && !hasAcceptedAllRequiredDocuments)
              }
              className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
            >
              {submitting === "approve" || submitting === "approve_changes" ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting === "approve" || submitting === "approve_changes" ? "Submitting..." : "Submit Approval"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSigningOutstandingDocuments}
        onOpenChange={(open) => {
          if (!open) {
            setIsSigningOutstandingDocuments(false);
            clearSignature();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Outstanding Documents</DialogTitle>
            <DialogDescription>
              Review each outstanding document, then add your signature and submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">Outstanding documents</p>
            {unsignedManualDocuments.map((config, index) => (
              <div key={`manual-outstanding-${config.id || "missing"}-${index}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm text-slate-700">{getConfigDocumentDisplayName(config)}</span>
                  <button
                    type="button"
                    onClick={() => openDocumentFromConfig(config)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View Document
                  </button>
                </div>
              </div>
            ))}
            {unsignedManualDocuments.length === 0 && (
              <p className="text-xs text-slate-600">No outstanding documents need signature.</p>
            )}
          </div>
          {signaturePad}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSigningOutstandingDocuments(false);
                clearSignature();
              }}
              disabled={submitting !== null}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSignManualDocuments}
              disabled={submitting !== null || !hasSignature || unsignedManualDocuments.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
            >
              {submitting !== null ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting !== null ? "Submitting..." : "Submit Signature"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDocument !== null} onOpenChange={(open) => !open && setActiveDocument(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{activeDocument?.title || "Document"}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm min-h-0 max-w-none flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-1 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-9 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
            dangerouslySetInnerHTML={{
              __html: renderDocumentTemplateMarkdownHtml(activeDocument?.content || "No document text available."),
            }}
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setActiveDocument(null)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatAgreementLabel(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildApprovedChangeOrderDocumentText(params: {
  changedAt: string | null;
  items: LineItem[];
  approvedVia: string | null;
  approvedAt: string | null;
  hasSignature: boolean;
  total: number;
}): string {
  const dateLabel = params.changedAt
    ? new Date(params.changedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "Unknown date";
  const approvalDateLabel = params.approvedAt
    ? new Date(params.approvedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : dateLabel;
  const approvedByLabel =
    params.hasSignature || params.approvedVia === "customer_link" || params.approvedVia === "manual_signature"
      ? `By Signature on ${approvalDateLabel}`
      : "By company approval";

  const lines = [
    "CHANGE ORDER",
    `Approved On: ${dateLabel}`,
    `Approved By: ${approvedByLabel}`,
    "",
    "Edited Line Items:",
  ];

  if (params.items.length === 0) {
    lines.push("No line items found.");
    lines.push("");
    lines.push(`Total: $${Number(params.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    return lines.join("\n");
  }

  for (const item of params.items) {
    const typeLabel = item.change_order_type ? item.change_order_type.toUpperCase() : "UPDATED";
    lines.push(`- [${typeLabel}] ${item.name}`);
    if (item.description) {
      lines.push(`  ${item.description}`);
    }
    lines.push(`  ${Number(item.quantity || 0)} ${item.unit || "item"} x $${Number(item.unit_price || 0).toFixed(2)} = $${Number(item.total || 0).toFixed(2)}`);
  }

  lines.push("");
  lines.push(`Total: $${Number(params.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return lines.join("\n");
}

function buildOriginalEstimateDocumentText(params: {
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  taxRate: number;
}): string {
  const lines = ["ORIGINAL ESTIMATE", "", "Line Items:"];

  if (!params.lineItems || params.lineItems.length === 0) {
    lines.push("No line items found.");
  } else {
    for (const item of params.lineItems) {
      lines.push(`- ${item.name}`);
      if (item.description) lines.push(`  ${item.description}`);
      lines.push(`  ${Number(item.quantity || 0)} ${item.unit || "item"} x $${Number(item.unit_price || 0).toFixed(2)} = $${Number(item.total || 0).toFixed(2)}`);
    }
  }

  lines.push("");
  lines.push(`Subtotal: $${Number(params.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push(`Tax (${(Number(params.taxRate || 0) * 100).toFixed(1)}%): $${Number(params.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  if (Number(params.discount || 0) > 0) {
    lines.push(`Discount: -$${Number(params.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }
  lines.push(`Total: $${Number(params.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  return lines.join("\n");
}
