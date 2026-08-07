import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Package, Pencil, Presentation, Settings, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useJobChecklist } from "@/hooks/useJobChecklist";
import { getBrandFontOption, loadGoogleBrandFont } from "@/lib/brandFonts";
import { buildClientPortalShareUrl } from "@/lib/clientPortalUrl";
import { approveEstimateManuallyById } from "@/lib/estimateApproval";
import { renderDocumentTemplateMarkdownHtml } from "@/lib/documentTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SECTIONS = [
  { key: "cover_page", label: "Cover Page" },
  { key: "scope_of_work", label: "Scope of Work" },
  { key: "meet_your_team", label: "Meet Your Team" },
  { key: "materials", label: "Material Selections" },
  { key: "project_visualization", label: "Project Visualization" },
  { key: "pricing_options", label: "Pricing Options" },
  { key: "agreements_and_signatures", label: "Agreements & Signatures" },
] as const;


const formatRoleLabel = (role?: string | null) => {
  if (!role) return "";
  return role
    .replaceAll("_", " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getInitials = (name?: string | null) => {
  if (!name) return "TM";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TM";
};

const JOB_KEYWORDS_PATTERN = /\b(job|renovation|project|installation|install|repair|service|cleanup|clean|patio|yard|lawn|landscape)\b/i;

const isLikelyPersonName = (value?: string | null) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (JOB_KEYWORDS_PATTERN.test(trimmed)) return false;
  return /^[A-Za-z][A-Za-z'-.]*(?:\s+[A-Za-z][A-Za-z'-.]*){0,3}$/.test(trimmed);
};

const isLikelyJobName = (value?: string | null) => {
  if (!value) return false;
  return JOB_KEYWORDS_PATTERN.test(value.trim());
};

const stripTrailingJobSuffix = (value?: string | null) =>
  (value || "").replace(/\s+job\s*$/i, "").trim();

const formatAddressWithCity = (address?: string | null, city?: string | null) => {
  const street = (address || "").trim().replace(/\s+/g, " ");
  const cityValue = (city || "").trim();
  if (!street) return cityValue;
  if (!cityValue) return street;
  if (street.toLowerCase().includes(cityValue.toLowerCase())) return street;
  return `${street}, ${cityValue}`;
};

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface ProposalDocumentTemplateRecord {
  id: string;
  name: string;
  system_key: string | null;
  body: string | null;
}

interface ProposalJobDocumentConfigRecord {
  id: string;
  lead_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: string;
  requires_signature: boolean;
  sort_order: number;
  template: ProposalDocumentTemplateRecord | null;
}

interface ProposalJobDocumentRecord {
  id: string;
  template_id: string | null;
  config_id: string | null;
  document_key: string;
  file_path: string;
  created_at: string;
}

const isJobDocumentsConfigIdMissing = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code || "");
  const message = String((error as { message?: string }).message || "").toLowerCase();
  return code === "42703" && message.includes("job_documents.config_id");
};

const normalizeProposalConfigRows = (rows: unknown[]): ProposalJobDocumentConfigRecord[] =>
  rows.map((row) => {
    const record = row as Record<string, any>;
    const rawTemplate = record.template;
    const template = Array.isArray(rawTemplate)
      ? (rawTemplate[0] as ProposalDocumentTemplateRecord | undefined) || null
      : (rawTemplate as ProposalDocumentTemplateRecord | null);

    return {
      id: String(record.id || ""),
      lead_id: String(record.lead_id || ""),
      template_id: String(record.template_id || ""),
      include_in_job: Boolean(record.include_in_job),
      email_timing: String(record.email_timing || "never"),
      requires_signature: Boolean(record.requires_signature),
      sort_order: Number(record.sort_order || 0),
      template,
    };
  });

export function EstimateProposalPanel({
  estimate,
  estimateVersions,
  displayLineItems,
  onRefresh,
}: {
  estimate: any;
  estimateVersions: any[];
  displayLineItems: any[];
  onRefresh: () => Promise<void> | void;
}) {
  const { currentAccount, user } = useAuth();
  const SIGNATURE_CANVAS_WIDTH = 600;
  const SIGNATURE_CANVAS_HEIGHT = 180;
  const isTestMode = import.meta.env.MODE === "test";
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBeforePhotos, setUploadingBeforePhotos] = useState(false);
  const [uploadingMaterialId, setUploadingMaterialId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [openEditorSection, setOpenEditorSection] = useState<string>("");
  const [selectedDocumentPreview, setSelectedDocumentPreview] = useState<{ title: string; content: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [portalLink, setPortalLink] = useState("");
  const [portalLinkLoading, setPortalLinkLoading] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [scopeGeneratorOpen, setScopeGeneratorOpen] = useState(false);
  const [rawScopeDescription, setRawScopeDescription] = useState("");
  const [generatingScope, setGeneratingScope] = useState(false);
  const [advancingFromPricing, setAdvancingFromPricing] = useState(false);
  const [scopeItemDialogOpen, setScopeItemDialogOpen] = useState(false);
  const [scopeItemDraftLabel, setScopeItemDraftLabel] = useState("");
  const [scopeItemDraftDescription, setScopeItemDraftDescription] = useState("");
  const [editingScopeItemId, setEditingScopeItemId] = useState<string | null>(null);
  const [customDepositPercentage, setCustomDepositPercentage] = useState("33");
  const [customMidpointPercentage, setCustomMidpointPercentage] = useState("33");
  const [customFinalPercentage, setCustomFinalPercentage] = useState("34");
  const [customWarrantyLength, setCustomWarrantyLength] = useState("2 years");
  const [selectedPricingOptionId, setSelectedPricingOptionId] = useState<string | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<Array<{ filePath: string; url: string }>>([]);
  const [activeVisualizationIndex, setActiveVisualizationIndex] = useState(0);
  const [proposalDocumentConfigs, setProposalDocumentConfigs] = useState<ProposalJobDocumentConfigRecord[]>([]);
  const [proposalDocumentsByKey, setProposalDocumentsByKey] = useState<Record<string, ProposalJobDocumentRecord>>({});
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingSignatureRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const teamMembersQuery = isTestMode ? ({ data: [] } as any) : useTeamMembers();
  const checklistQuery = isTestMode
    ? ({
        items: [],
        addItem: { mutateAsync: async () => undefined },
        updateItem: { mutateAsync: async () => undefined },
        deleteItem: { mutateAsync: async () => undefined },
      } as any)
    : useJobChecklist(estimate?.job_id || undefined);
  const teamMembers = teamMembersQuery.data || [];
  const checklistItems = checklistQuery.items || [];
  const addItem = checklistQuery.addItem;
  const updateItem = checklistQuery.updateItem;
  const deleteItem = checklistQuery.deleteItem;

  const getScopeItemDescription = (item: any) =>
    typeof item?.metadata?.description === "string" ? item.metadata.description.trim() : "";

  const buildScopeItemMetadata = (existingMetadata: unknown, description: string) => {
    const base =
      existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
        ? { ...(existingMetadata as Record<string, unknown>) }
        : {};
    base.category = "task";
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 0) {
      base.description = trimmedDescription;
    } else {
      delete base.description;
    }
    return base;
  };

  const formatScopeItemForProposal = (item: any) => {
    const label = String(item?.label || "").trim();
    const description = getScopeItemDescription(item);
    if (!label) return "";
    return description ? `${label}: ${description}` : label;
  };

  const currentSettings = (estimate?.proposal_settings || {}) as any;
  const currentSections = currentSettings.sections || {};
  const sectionState = useMemo(
    () =>
      SECTIONS.reduce((acc, section) => {
        acc[section.key] = currentSections[section.key] !== false;
        return acc;
      }, {} as Record<string, boolean>),
    [currentSections],
  );

  const selectedTeamIds = useMemo(
    () => new Set<string>(Array.isArray(currentSettings.team_member_ids) ? currentSettings.team_member_ids : []),
    [currentSettings.team_member_ids],
  );
  const materialOptions = useMemo(() => {
    const byName = new Map<string, { key: string; name: string }>();

    for (const item of displayLineItems || []) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const nameKey = name.toLowerCase();
      const key = String(item?.id || `name:${nameKey}`);
      if (!byName.has(nameKey)) byName.set(nameKey, { key, name });
    }

    for (const version of estimateVersions || []) {
      const versionItems = Array.isArray(version?.line_items) ? version.line_items : [];
      for (const item of versionItems) {
        const name = String(item?.name || "").trim();
        if (!name) continue;
        const nameKey = name.toLowerCase();
        if (!byName.has(nameKey)) {
          byName.set(nameKey, { key: `name:${nameKey}`, name });
        }
      }
    }

    return Array.from(byName.values());
  }, [displayLineItems, estimateVersions]);
  const selectedLineItemIds = useMemo(
    () => {
      if (Array.isArray(currentSettings.highlight_line_item_ids)) {
        return new Set<string>(currentSettings.highlight_line_item_ids);
      }
      return new Set<string>(materialOptions.map((item) => item.key));
    },
    [currentSettings.highlight_line_item_ids, materialOptions],
  );
  const highlightedLineItemNames = useMemo(() => {
    const selectedIds = selectedLineItemIds;
    return new Set(
      materialOptions
        .filter((item) => selectedIds.has(item.key))
        .map((item) => item.name.trim().toLowerCase())
        .filter((name: string) => name.length > 0),
    );
  }, [materialOptions, selectedLineItemIds]);
  const materialImageMap = useMemo(
    () =>
      currentSettings.material_images && typeof currentSettings.material_images === "object"
        ? (currentSettings.material_images as Record<string, string>)
        : {},
    [currentSettings.material_images],
  );
  const visualizationPhotos = useMemo(() => {
    const saved = Array.isArray(currentSettings.project_visualization_image_urls)
      ? currentSettings.project_visualization_image_urls.filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0)
      : [];
    const legacy = typeof estimate?.project_visualization_image_url === "string" ? estimate.project_visualization_image_url.trim() : "";
    const merged = legacy ? [legacy, ...saved] : saved;
    return Array.from(new Set(merged));
  }, [currentSettings.project_visualization_image_urls, estimate?.project_visualization_image_url]);
  const selectedBeforePhotoPaths = useMemo(() => {
    const availablePaths = beforePhotos.map((photo) => photo.filePath);
    if (!Array.isArray(currentSettings.before_photo_file_paths)) {
      return new Set<string>(availablePaths);
    }
    const filtered = currentSettings.before_photo_file_paths.filter(
      (value: unknown): value is string => typeof value === "string" && availablePaths.includes(value),
    );
    return new Set<string>(filtered);
  }, [beforePhotos, currentSettings.before_photo_file_paths]);
  const displayedBeforePhotoUrls = useMemo(
    () => beforePhotos.filter((photo) => selectedBeforePhotoPaths.has(photo.filePath)).map((photo) => photo.url),
    [beforePhotos, selectedBeforePhotoPaths],
  );
  const configsWithTemplate = useMemo(
    () =>
      proposalDocumentConfigs
        .filter((config) => Boolean(config.template))
        .sort((a, b) => a.sort_order - b.sort_order),
    [proposalDocumentConfigs],
  );

  const getUploadedDocumentForConfig = useCallback(
    (config: Pick<ProposalJobDocumentConfigRecord, "id" | "template_id">) => {
      const directByConfig = proposalDocumentsByKey[`config:${config.id}`];
      if (directByConfig) return directByConfig;

      const templateMatches = configsWithTemplate.filter((item) => item.template_id === config.template_id);
      const hasDuplicatesForTemplate = templateMatches.length > 1;
      if (hasDuplicatesForTemplate) return null;

      const directByTemplate = proposalDocumentsByKey[`template:${config.template_id}`];
      if (directByTemplate) return directByTemplate;

      return null;
    },
    [configsWithTemplate, proposalDocumentsByKey],
  );
  const approvalRequiredDocuments = useMemo(
    () =>
      configsWithTemplate.filter(
        (config) => config.include_in_job && config.email_timing === "on_estimate_approval" && config.requires_signature,
      ),
    [configsWithTemplate],
  );
  const manuallySentDocuments = useMemo(
    () =>
      configsWithTemplate.filter((config) => {
        if (!config.include_in_job || config.email_timing !== "manual" || !config.requires_signature) return false;
        return Boolean(getUploadedDocumentForConfig(config));
      }),
    [configsWithTemplate, getUploadedDocumentForConfig],
  );
  const presentationApprovalDocuments = useMemo(() => {
    const byConfigId = new Map<string, ProposalJobDocumentConfigRecord>();
    for (const config of approvalRequiredDocuments) {
      byConfigId.set(config.id, config);
    }
    for (const config of manuallySentDocuments) {
      byConfigId.set(config.id, config);
    }
    return Array.from(byConfigId.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [approvalRequiredDocuments, manuallySentDocuments]);
  const activeVisualizationUrl =
    visualizationPhotos[Math.min(activeVisualizationIndex, Math.max(visualizationPhotos.length - 1, 0))] || "";
  const websiteSettings = estimate?.account?.settings?.website || {};
  const headingFont = getBrandFontOption(websiteSettings?.font);
  const bodyFont = getBrandFontOption(websiteSettings?.body_font);
  loadGoogleBrandFont(headingFont);
  loadGoogleBrandFont(bodyFont);
  const primaryColor = estimate?.account?.settings?.client_portal_color || "#0f172a";
  const textColor = estimate?.account?.settings?.client_portal_text_color || "#ffffff";
  const accentColor = estimate?.account?.settings?.client_portal_highlight_color || primaryColor;
  const rawCustomerName = estimate?.customer?.name?.trim() || "";
  const rawJobName = estimate?.job?.name?.trim() || "";
  const hasTrailingJobSuffix = /\sjob\s*$/i.test(rawJobName);
  const isInvertedNamePair =
    (isLikelyPersonName(rawJobName) && isLikelyJobName(rawCustomerName)) ||
    (hasTrailingJobSuffix && isLikelyJobName(rawCustomerName));

  const preparedForName = (
    isInvertedNamePair
      ? stripTrailingJobSuffix(rawJobName) || rawJobName
      : rawCustomerName
  ) || "Client";

  const fallbackJobName = (
    isInvertedNamePair
      ? rawCustomerName
      : rawJobName
  );
  const displayCoverTitle = currentSettings.title || fallbackJobName || "Project";
  const preparedForAddressLine = formatAddressWithCity(
    estimate?.job?.address || estimate?.customer?.address,
    estimate?.job?.city || estimate?.customer?.city,
  );
  const preparedDate = format(new Date(), "MMMM d, yyyy");
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const isEstimateAlreadyApproved = estimate?.status === "accepted";
  const isProposalLocked = isEstimateAlreadyApproved;
  const isFreePlan = currentAccount?.pricing_plan === "free";
  const getActivePricingOptionId = () => selectedPricingOptionId || currentSettings?.recommended_version_id || estimateVersions[0]?.id || null;
  const isWarrantyEnabledForVersion = (versionId: string | null) => {
    if (!versionId) return true;
    const settings =
      currentSettings?.version_warranty_enabled && typeof currentSettings.version_warranty_enabled === "object"
        ? (currentSettings.version_warranty_enabled as Record<string, unknown>)
        : {};
    const value = settings[versionId];
    return value === undefined ? true : value === true;
  };
  const isWarrantyEnabledForActiveVersion = isWarrantyEnabledForVersion(getActivePricingOptionId());
  const hasGeneratedAgreements = useMemo(
    () => true,
    [],
  );
  const selectedTeamMemberCount = useMemo(
    () => teamMembers.filter((member) => selectedTeamIds.has(member.user_id)).length,
    [teamMembers, selectedTeamIds],
  );
  const sectionAvailability = useMemo(
    () => ({
      cover_page: Boolean(String(currentSettings.title || fallbackJobName || "").trim()),
      scope_of_work: checklistItems.length > 0,
      meet_your_team: selectedTeamMemberCount > 0,
      materials: materialOptions.length > 0 && selectedLineItemIds.size > 0,
      project_visualization: visualizationPhotos.length > 0 || displayedBeforePhotoUrls.length > 0,
      pricing_options: estimateVersions.length > 0,
      agreements_and_signatures: true,
    }),
    [
      checklistItems.length,
      currentSettings.title,
      displayedBeforePhotoUrls.length,
      estimateVersions.length,
      fallbackJobName,
      hasGeneratedAgreements,
      materialOptions.length,
      selectedLineItemIds.size,
      selectedTeamMemberCount,
      visualizationPhotos.length,
    ],
  );
  const effectiveSectionState = useMemo(
    () =>
      SECTIONS.reduce((acc, section) => {
        acc[section.key] = sectionState[section.key] && sectionAvailability[section.key];
        return acc;
      }, {} as Record<string, boolean>),
    [sectionAvailability, sectionState],
  );
  const sectionDisabledReason = useMemo(
    () => ({
      cover_page: sectionAvailability.cover_page ? "" : "Add a proposal title.",
      scope_of_work: sectionAvailability.scope_of_work ? "" : "Add at least one scope task.",
      meet_your_team: sectionAvailability.meet_your_team ? "" : "Select at least one team member.",
      materials: sectionAvailability.materials ? "" : "Select at least one material item.",
      project_visualization: sectionAvailability.project_visualization ? "" : "Upload or select at least one image.",
      pricing_options: sectionAvailability.pricing_options ? "" : "Create at least one estimate version.",
      agreements_and_signatures: sectionAvailability.agreements_and_signatures ? "" : "Attach approval document templates.",
    }),
    [sectionAvailability],
  );

  const getDefaultPaymentSchedule = () => {
    const paymentDefaultsRaw = estimate?.account?.settings?.default_payment_schedule;
    const paymentDefaults =
      paymentDefaultsRaw && typeof paymentDefaultsRaw === "object" && !Array.isArray(paymentDefaultsRaw)
        ? (paymentDefaultsRaw as Record<string, unknown>)
        : {};
    const depositPercentage = Number(paymentDefaults.deposit_percentage ?? 33);
    const midpointPercentage = Number(paymentDefaults.midpoint_percentage ?? 33);
    const finalPercentage = Number(paymentDefaults.final_percentage ?? 34);

    return {
      depositPercentage: Number.isFinite(depositPercentage) ? depositPercentage : 33,
      midpointPercentage: Number.isFinite(midpointPercentage) ? midpointPercentage : 33,
      finalPercentage: Number.isFinite(finalPercentage) ? finalPercentage : 34,
    };
  };

  const getEffectivePaymentSchedule = () => {
    const defaults = getDefaultPaymentSchedule();
    const paymentScheduleRaw = currentSettings?.payment_schedule;
    const paymentSchedule =
      paymentScheduleRaw && typeof paymentScheduleRaw === "object" && !Array.isArray(paymentScheduleRaw)
        ? (paymentScheduleRaw as Record<string, unknown>)
        : {};

    const depositPercentage = Number(paymentSchedule.deposit_percentage ?? defaults.depositPercentage);
    const midpointPercentage = Number(paymentSchedule.midpoint_percentage ?? defaults.midpointPercentage);
    const finalPercentage = Number(paymentSchedule.final_percentage ?? defaults.finalPercentage);

    return {
      depositPercentage: Number.isFinite(depositPercentage) ? depositPercentage : defaults.depositPercentage,
      midpointPercentage: Number.isFinite(midpointPercentage) ? midpointPercentage : defaults.midpointPercentage,
      finalPercentage: Number.isFinite(finalPercentage) ? finalPercentage : defaults.finalPercentage,
    };
  };

  const getSelectedWarrantyLength = () => {
    const activeVersionId = getActivePricingOptionId();
    const warrantyLengthsRaw = currentSettings?.version_warranty_lengths;
    const warrantyLengths =
      warrantyLengthsRaw && typeof warrantyLengthsRaw === "object" && !Array.isArray(warrantyLengthsRaw)
        ? (warrantyLengthsRaw as Record<string, unknown>)
        : {};
    const selectedValue = activeVersionId ? String(warrantyLengths[activeVersionId] || "").trim() : "";
    return selectedValue || "2 years";
  };

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

  useEffect(() => {
    if (estimateVersions.length === 0) {
      setSelectedPricingOptionId(null);
      return;
    }

    setSelectedPricingOptionId((previous) => {
      if (previous && estimateVersions.some((version) => version.id === previous)) {
        return previous;
      }

      const recommendedVersionId = currentSettings?.recommended_version_id;
      if (recommendedVersionId && estimateVersions.some((version) => version.id === recommendedVersionId)) {
        return recommendedVersionId;
      }

      return estimateVersions[0].id;
    });
  }, [estimateVersions, currentSettings?.recommended_version_id]);

  useEffect(() => {
    const paymentSchedule = getEffectivePaymentSchedule();
    setCustomDepositPercentage(String(paymentSchedule.depositPercentage));
    setCustomMidpointPercentage(String(paymentSchedule.midpointPercentage));
    setCustomFinalPercentage(String(paymentSchedule.finalPercentage));
  }, [currentSettings?.payment_schedule, estimate?.account?.settings?.default_payment_schedule]);

  useEffect(() => {
    setCustomWarrantyLength(getSelectedWarrantyLength());
  }, [selectedPricingOptionId, currentSettings?.version_warranty_lengths, currentSettings?.recommended_version_id, estimateVersions]);

  useEffect(() => {
    if (isTestMode) {
      setProposalDocumentConfigs([]);
      setProposalDocumentsByKey({});
      return;
    }

    const leadId = estimate?.job_id;
    if (!leadId) {
      setProposalDocumentConfigs([]);
      setProposalDocumentsByKey({});
      return;
    }

    let cancelled = false;
    const fetchProposalDocuments = async () => {
      const [configResult] = await Promise.all([
        supabase
          .from("job_document_configs")
          .select(
            "id, lead_id, template_id, include_in_job, email_timing, requires_signature, sort_order, template:document_templates(id, name, system_key, body)",
          )
          .eq("lead_id", leadId)
          .order("sort_order", { ascending: true }),
      ]);
      let documentResult = await supabase
        .from("job_documents")
        .select("id, template_id, config_id, document_key, file_path, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (isJobDocumentsConfigIdMissing(documentResult.error)) {
        documentResult = await supabase
          .from("job_documents")
          .select("id, template_id, document_key, file_path, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });
      }

      if (cancelled) return;

      if (configResult.error) {
        console.error("Failed to fetch proposal document configs:", configResult.error);
        setProposalDocumentConfigs([]);
      } else {
        setProposalDocumentConfigs(normalizeProposalConfigRows((configResult.data || []) as unknown[]));
      }

      if (documentResult.error) {
        console.error("Failed to fetch proposal documents:", documentResult.error);
        setProposalDocumentsByKey({});
      } else {
        const next: Record<string, ProposalJobDocumentRecord> = {};
        for (const rawDocument of (documentResult.data || []) as ProposalJobDocumentRecord[]) {
          const configKey = rawDocument.config_id ? `config:${rawDocument.config_id}` : "";
          const templateKey = rawDocument.template_id ? `template:${rawDocument.template_id}` : "";
          const key = configKey || templateKey || `legacy:${rawDocument.document_key}`;
          if (!key || next[key]) continue;
          next[key] = rawDocument;
        }
        setProposalDocumentsByKey(next);
      }
    };

    void fetchProposalDocuments();

    return () => {
      cancelled = true;
    };
  }, [estimate?.job_id, isTestMode]);

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = getSignatureContext();
    if (!canvas || !context) return;

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

  const saveProposal = async (nextSettings: any, extras?: Record<string, any>) => {
    if (isProposalLocked) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("estimates")
        .update({
          proposal_settings: nextSettings,
          ...(extras || {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", estimate.id);
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      toast.error("Failed to save proposal settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (key: string, value: boolean) => {
    const next = {
      ...currentSettings,
      sections: {
        ...sectionState,
        [key]: value,
      },
    };
    void saveProposal(next);
  };

  const updateTitle = (title: string) => {
    const next = { ...currentSettings, title };
    void saveProposal(next);
  };

  const toggleTeamMember = (userId: string, checked: boolean) => {
    const nextIds = new Set(selectedTeamIds);
    if (checked) nextIds.add(userId);
    else nextIds.delete(userId);
    const next = { ...currentSettings, team_member_ids: Array.from(nextIds) };
    void saveProposal(next);
  };

  const toggleHighlightLineItem = (lineItemId: string, checked: boolean) => {
    const nextIds = new Set(selectedLineItemIds);
    if (checked) nextIds.add(lineItemId);
    else nextIds.delete(lineItemId);
    const next = { ...currentSettings, highlight_line_item_ids: Array.from(nextIds) };
    void saveProposal(next);
  };

  const handleUploadVisualization = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isProposalLocked) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !estimate?.id) return;
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `estimate-proposals/${estimate.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("lead-photos").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("lead-photos").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
      const nextPhotos = Array.from(new Set([...visualizationPhotos, ...uploadedUrls]));
      const nextSettings = { ...currentSettings, project_visualization_image_urls: nextPhotos };
      await saveProposal(nextSettings, { project_visualization_image_url: nextPhotos[0] || null });
      setActiveVisualizationIndex(Math.max(0, nextPhotos.length - uploadedUrls.length));
      toast.success("Visualization photos uploaded");
    } catch {
      toast.error("Failed to upload visualization");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveVisualizationPhoto = async (photoUrl: string) => {
    if (isProposalLocked) return;
    const nextPhotos = visualizationPhotos.filter((url) => url !== photoUrl);
    if (nextPhotos.length === visualizationPhotos.length) return;
    const nextSettings = { ...currentSettings, project_visualization_image_urls: nextPhotos };
    await saveProposal(nextSettings, { project_visualization_image_url: nextPhotos[0] || null });
    setActiveVisualizationIndex((value) => Math.min(value, Math.max(nextPhotos.length - 1, 0)));
    toast.success("Visualization photo removed");
  };

  const handleUploadMaterialImage = async (lineItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (isProposalLocked) return;
    const file = event.target.files?.[0];
    if (!file || !estimate?.id) return;
    setUploadingMaterialId(lineItemId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `estimate-proposals/${estimate.id}/materials/${lineItemId}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("lead-photos").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lead-photos").getPublicUrl(path);
      const next = {
        ...currentSettings,
        material_images: {
          ...materialImageMap,
          [lineItemId]: data.publicUrl,
        },
      };
      await saveProposal(next);
      toast.success("Material image uploaded");
    } catch {
      toast.error("Failed to upload material image");
    } finally {
      setUploadingMaterialId(null);
      event.target.value = "";
    }
  };

  const updateVersionDescription = (versionId: string, description: string) => {
    const currentDescriptions =
      currentSettings.version_descriptions && typeof currentSettings.version_descriptions === "object"
        ? currentSettings.version_descriptions
        : {};
    void saveProposal({
      ...currentSettings,
      version_descriptions: {
        ...currentDescriptions,
        [versionId]: description,
      },
    });
  };

  const updateVersionSubtitle = (versionId: string, subtitle: string) => {
    const currentSubtitles =
      currentSettings.version_subtitles && typeof currentSettings.version_subtitles === "object"
        ? currentSettings.version_subtitles
        : {};
    void saveProposal({
      ...currentSettings,
      version_subtitles: {
        ...currentSubtitles,
        [versionId]: subtitle,
      },
    });
  };

  const updateRecommendedVersion = (versionId: string) => {
    const nextValue = versionId === "__none__" ? null : versionId;
    void saveProposal({
      ...currentSettings,
      recommended_version_id: nextValue,
    });
  };

  const openApprovalDocumentPreview = useCallback((config: ProposalJobDocumentConfigRecord) => {
    const template = config.template;
    if (!template) {
      toast.error("No document available.");
      return;
    }

    const content = String(template.body || "").trim();

    if (!content) {
      toast.error("No agreement text available for this document.");
      return;
    }

    setSelectedDocumentPreview({
      title: template.name || "Agreement",
      content,
    });
  }, []);

  const saveCustomPaymentSchedule = () => {
    if (isProposalLocked) return;
    const parsedDeposit = parseFloat(customDepositPercentage) || 0;
    const parsedMidpoint = parseFloat(customMidpointPercentage) || 0;
    const parsedFinal = parseFloat(customFinalPercentage) || 0;
    const total = parsedDeposit + parsedMidpoint + parsedFinal;

    if (
      parsedDeposit < 0
      || parsedMidpoint < 0
      || parsedFinal < 0
      || Math.abs(total - 100) > 0.01
    ) {
      toast.error("Payment schedule must be non-negative and total 100%");
      return;
    }

    void saveProposal({
      ...currentSettings,
      payment_schedule: {
        deposit_percentage: parsedDeposit,
        midpoint_percentage: parsedMidpoint,
        final_percentage: parsedFinal,
      },
    });
  };

  const saveCustomWarrantyLength = () => {
    if (isProposalLocked) return;
    const activeVersionId = getActivePricingOptionId();
    if (!activeVersionId) return;

    const trimmed = customWarrantyLength.trim();
    if (!trimmed) {
      toast.error("Warranty length is required");
      return;
    }

    const currentWarrantyLengths =
      currentSettings.version_warranty_lengths && typeof currentSettings.version_warranty_lengths === "object"
        ? currentSettings.version_warranty_lengths
        : {};

    void saveProposal({
      ...currentSettings,
      version_warranty_lengths: {
        ...currentWarrantyLengths,
        [activeVersionId]: trimmed,
      },
    });
  };

  const saveWarrantyEnabledForActiveVersion = (enabled: boolean) => {
    if (isProposalLocked) return;
    const activeVersionId = getActivePricingOptionId();
    if (!activeVersionId) return;
    const currentSettingsMap =
      currentSettings.version_warranty_enabled && typeof currentSettings.version_warranty_enabled === "object"
        ? currentSettings.version_warranty_enabled
        : {};
    void saveProposal({
      ...currentSettings,
      version_warranty_enabled: {
        ...currentSettingsMap,
        [activeVersionId]: enabled,
      },
    });
  };

  const slides = useMemo(() => {
    const list: Array<{ key: string; title: string; content: React.ReactNode }> = [];

    if (effectiveSectionState.cover_page) {
      list.push({
        key: "cover_page",
        title: "Cover",
        content: (
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: primaryColor, color: textColor }}>
            {estimate?.account?.logo_url ? (
              <img src={estimate.account.logo_url} alt="Company logo" className="mx-auto h-16 mb-6" />
            ) : null}
            <h2 style={{ fontFamily: headingFont?.css || "inherit" }} className="text-6xl md:text-7xl font-bold">
              {displayCoverTitle}
            </h2>
            <p className="mt-4 text-2xl font-semibold opacity-90">{estimate?.account?.company_name || "Company"}</p>
            <div className="mx-auto mt-10 w-fit min-w-[20rem] max-w-[20rem] md:min-w-[34rem] md:max-w-[34rem] rounded-2xl bg-white/10 px-8 py-6">
              <p className="text-2xl font-semibold opacity-80">Prepared for</p>
              <p className="mt-2 text-4xl md:text-5xl font-semibold">{preparedForName}</p>
              <p className="mt-3 text-2xl font-semibold opacity-90">{preparedForAddressLine || "Address to be confirmed"}</p>
            </div>
            <p className="mt-10 text-2xl font-semibold opacity-70">{preparedDate}</p>
          </div>
        ),
      });
    }

    if (effectiveSectionState.scope_of_work) {
      list.push({
        key: "scope_of_work",
        title: "Scope of Work",
        content: (
          <div className="rounded-lg bg-white p-8">
            <h3 className="text-3xl font-semibold mb-8">Scope of Work</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-start gap-6">
                  <CheckCircle2 className="h-9 w-9 shrink-0 text-slate-700 mt-0.5" />
                  <div>
                    <p className="text-3xl font-medium leading-tight">{item.label}</p>
                    {getScopeItemDescription(item) ? (
                      <p className="mt-2 text-xl text-slate-600 leading-snug">{getScopeItemDescription(item)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (effectiveSectionState.meet_your_team) {
      list.push({
        key: "meet_your_team",
        title: "Meet Your Team",
        content: (
          <div className="rounded-lg bg-white p-8 min-h-[70vh] flex flex-col">
            <h3 className="text-3xl font-semibold mb-8">Meet Your Team</h3>
            {teamMembers.length > 0 ? (
              <div className="flex-1 flex items-center">
                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,260px))] justify-center gap-8">
                  {teamMembers
                    .filter((member) => selectedTeamIds.size === 0 || selectedTeamIds.has(member.user_id))
                    .map((member) => (
                      <div
                        key={member.user_id}
                        className="w-full rounded-xl border border-border bg-slate-50 p-5 text-center"
                      >
                        <Avatar className="h-[7.5rem] w-[7.5rem] border border-border bg-background mb-3 mx-auto">
                          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={member.full_name} /> : null}
                          <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <p className="text-3xl font-semibold">{member.full_name}</p>
                        {member.role ? (
                          <div className="mt-2 flex justify-center">
                            <Badge variant="secondary" className="px-4 py-1.5 text-lg font-medium">
                              {formatRoleLabel(member.role)}
                            </Badge>
                          </div>
                        ) : null}
                        {member.description ? (
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {member.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-lg text-muted-foreground">No team members selected yet.</p>
            )}
          </div>
        ),
      });
    }

    if (effectiveSectionState.materials) {
      const selectedItems = materialOptions.filter((item) => selectedLineItemIds.size === 0 || selectedLineItemIds.has(item.key));
      list.push({
        key: "materials",
        title: "Material Selections",
        content: (
          <div className="rounded-lg bg-white p-8 min-h-[70vh] flex flex-col">
            <h3 className="text-3xl font-semibold mb-4">Material Selections</h3>
            {selectedItems.length > 0 ? (
              <div className="flex-1 flex items-center">
                <div className="mx-auto flex w-full max-w-[1040px] flex-wrap justify-center gap-5">
                  {selectedItems.map((item: any) => (
                    <div key={item.key} className="w-full max-w-[320px] rounded-2xl border border-border p-3 xl:basis-[320px]">
                      <div className="rounded-xl bg-muted/40 min-h-[11rem] flex items-center justify-center">
                        {materialImageMap[item.key] ? (
                          <img
                            src={materialImageMap[item.key]}
                            alt={`${item.name} material`}
                            className="h-full w-full min-h-[11rem] rounded-xl object-cover"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-3 text-center text-2xl font-semibold">{item.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-lg text-muted-foreground">No material selections chosen yet.</p>
            )}
          </div>
        ),
      });
    }

    if (effectiveSectionState.project_visualization) {
      list.push({
        key: "project_visualization",
        title: "Project Visualization",
        content: (
          <div className="rounded-lg bg-white p-4 sm:p-6 lg:p-8 min-h-0 flex flex-col">
            <h3 className="text-3xl font-semibold mb-4">Project Visualization</h3>
            <div className="flex-1 flex flex-col justify-center">
              {activeVisualizationUrl ? (
                <div
                  className={`mx-auto w-full ${displayedBeforePhotoUrls.length > 0 ? "max-w-6xl" : "max-w-4xl"}`}
                >
                  <div
                    className={`${
                      displayedBeforePhotoUrls.length > 0
                        ? "grid gap-6 lg:grid-cols-[16rem_36rem] lg:justify-center lg:items-start"
                        : "space-y-6"
                    }`}
                  >
                    {displayedBeforePhotoUrls.length > 0 ? (
                      <div>
                        <h4 className="text-2xl font-semibold mb-4 text-center lg:text-left">Before</h4>
                        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-1 lg:overflow-visible">
                          {displayedBeforePhotoUrls.map((url, index) => (
                            <img
                              key={`before-${url}-${index}`}
                              src={url}
                              alt={`Before photo ${index + 1}`}
                              className="w-full min-w-[16rem] rounded-lg border border-border object-contain snap-start lg:min-w-0"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <h4 className="text-2xl font-semibold mb-4 text-center lg:text-left">After</h4>
                      <div
                        className={`rounded-xl bg-white ${
                          displayedBeforePhotoUrls.length > 0 ? "p-2" : "mx-auto p-2"
                        }`}
                      >
                        <img
                          src={activeVisualizationUrl}
                          alt="Project visualization"
                          className="block w-full rounded-lg h-auto max-h-[calc(100dvh-24rem)] object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-lg text-muted-foreground">No project visualization uploaded yet.</p>
              )}
              {visualizationPhotos.length > 1 ? (
                <div className="mx-auto mt-4 flex w-full max-w-4xl items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveVisualizationIndex((value) => (value - 1 + visualizationPhotos.length) % visualizationPhotos.length)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {activeVisualizationIndex + 1} / {visualizationPhotos.length}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveVisualizationIndex((value) => (value + 1) % visualizationPhotos.length)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ),
      });
    }

    if (effectiveSectionState.pricing_options) {
      list.push({
        key: "pricing_options",
        title: "Pricing Options",
        content: (
          <div className="rounded-lg bg-white p-8 min-h-[70vh] flex flex-col">
            <h3 className="text-3xl font-semibold mb-4">Pricing Options</h3>
            {estimateVersions.length > 0 ? (
              <div className="flex-1 flex items-center">
                <div className="mx-auto flex w-full max-w-[1040px] flex-wrap justify-center gap-5">
                  {estimateVersions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => setSelectedPricingOptionId(version.id)}
                      className={`relative w-full max-w-[320px] rounded-2xl border px-5 py-7 text-left xl:basis-[320px] ${
                        selectedPricingOptionId === version.id
                          ? "bg-slate-100 ring-2"
                          : "border-border bg-muted/40"
                      }`}
                      style={
                        selectedPricingOptionId === version.id
                          ? { borderColor: primaryColor, boxShadow: `0 0 0 2px ${primaryColor}33` }
                          : undefined
                      }
                    >
                      {currentSettings?.recommended_version_id === version.id ? (
                        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                          <Badge
                            style={{
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                              color: textColor,
                            }}
                          >
                            Recommended
                          </Badge>
                        </div>
                      ) : null}
                      {selectedPricingOptionId === version.id ? (
                        <div className="absolute right-3 top-3">
                          <Badge variant="secondary">Selected</Badge>
                        </div>
                      ) : null}
                      <div className="space-y-0.5">
                        <p className="text-2xl font-semibold text-center">{version.name}</p>
                        {currentSettings?.version_subtitles?.[version.id] ? (
                          <p className="text-base text-center font-bold italic leading-tight whitespace-pre-wrap" style={{ color: accentColor }}>
                            {currentSettings.version_subtitles[version.id]}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-4 text-4xl font-bold text-center">${Number(version.total).toLocaleString()}</p>
                      {currentSettings?.version_descriptions?.[version.id] ? (
                        <p className="mt-4 text-base text-center text-muted-foreground whitespace-pre-wrap">
                          {currentSettings.version_descriptions[version.id]}
                        </p>
                      ) : null}
                      {(() => {
                        const versionItems = Array.isArray(version?.line_items) ? version.line_items : [];
                        const highlightedItems = versionItems.filter((item: any) =>
                          highlightedLineItemNames.has(String(item?.name || "").trim().toLowerCase()),
                        );

                        return highlightedItems.length > 0 ? (
                          <ul className="mt-5 list-disc list-inside space-y-2 text-center">
                            {highlightedItems.map((item: any, index: number) => (
                              <li key={`${version.id}-${index}-${item?.name || "item"}`} className="text-lg font-semibold">
                                {item?.name || "Unnamed item"}
                              </li>
                            ))}
                          </ul>
                        ) : null;
                      })()}
                      <div className="mt-6">
                        <span
                          className={`inline-flex w-full items-center justify-center rounded-lg border px-4 py-3 text-lg font-bold ${
                            selectedPricingOptionId === version.id
                              ? "text-white"
                              : "border-slate-300 bg-white text-slate-900"
                          }`}
                          style={
                            selectedPricingOptionId === version.id
                              ? { borderColor: primaryColor, backgroundColor: primaryColor }
                              : undefined
                          }
                        >
                          {selectedPricingOptionId === version.id ? "Selected" : "Select"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-lg text-muted-foreground">No pricing options available yet.</p>
            )}
          </div>
        ),
      });
    }

    if (effectiveSectionState.agreements_and_signatures) {
      list.push({
        key: "agreements_and_signatures",
        title: "Agreements & Signatures",
        content: (
          <div className="rounded-lg bg-white p-8">
            <h3 className="text-3xl font-semibold mb-4">Agreements & Signatures</h3>
            {presentationApprovalDocuments.length > 0 ? (
              <div className="space-y-3">
                {presentationApprovalDocuments.map((config) => {
                  const template = config.template;
                  return (
                    <div key={config.id} className="rounded border border-border bg-slate-50/60 p-4">
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                        {template?.name || "Document"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 rounded-full"
                        onClick={() => openApprovalDocumentPreview(config)}
                      >
                        View full agreement
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No approval-required documents are configured.</p>
            )}
            {isEstimateAlreadyApproved ? (
              <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">This estimate has already been approved.</p>
                <p className="mt-1 text-xs text-emerald-800">
                  No additional signature is required. Continue to the client portal slide.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">E-signature</p>
                    <p className="text-xs text-slate-500">Sign with your finger on mobile, or click and drag on desktop.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clearSignature} disabled={!hasSignature}>
                    Clear
                  </Button>
                </div>
                <div className="-mx-8 sm:mx-0">
                  <canvas
                    ref={signatureCanvasRef}
                    width={SIGNATURE_CANVAS_WIDTH}
                    height={SIGNATURE_CANVAS_HEIGHT}
                    onPointerDown={handleSignaturePointerDown}
                    onPointerMove={handleSignaturePointerMove}
                    onPointerUp={handleSignaturePointerUp}
                    onPointerCancel={handleSignaturePointerUp}
                    onPointerLeave={handleSignaturePointerUp}
                    className="h-40 w-full rounded-none border-y border-slate-200 bg-white touch-none sm:rounded-lg sm:border"
                    aria-label="Signature pad"
                  />
                </div>
                <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            )}
          </div>
        ),
      });
    }

    list.push({
      key: "client_portal_qr",
      title: "Client Portal",
      content: (
        <div className="rounded-lg bg-white p-8 min-h-[70vh] flex flex-col items-center justify-center text-center">
          <h3 className="text-3xl font-semibold">Client Portal Access</h3>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Scan this QR code to open your client portal and track project updates, estimates, and invoices.
          </p>
          {portalLink ? (
            <>
              <div className="mt-8 rounded-2xl border border-border bg-white p-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(portalLink)}`}
                  alt="Client portal QR code"
                  className="h-72 w-72"
                />
              </div>
              <p className="mt-6 text-sm text-muted-foreground break-all">{portalLink}</p>
            </>
          ) : (
            <p className="mt-8 text-base text-muted-foreground">
              {portalLinkLoading ? "Generating client portal link..." : "Client portal link unavailable."}
            </p>
          )}
        </div>
      ),
    });

    return list;
  }, [
    checklistItems,
    currentSettings.title,
    displayLineItems,
    estimate?.account?.company_name,
    estimate?.account?.logo_url,
    estimate?.customer?.name,
    estimate?.job?.name,
    estimate?.job?.address,
    estimate?.job?.city,
    estimate?.customer?.address,
    estimate?.customer?.city,
    estimate?.project_visualization_image_url,
    displayedBeforePhotoUrls,
    estimateVersions,
    headingFont?.css,
    highlightedLineItemNames,
    materialImageMap,
    primaryColor,
    effectiveSectionState.agreements_and_signatures,
    effectiveSectionState.cover_page,
    effectiveSectionState.materials,
    effectiveSectionState.meet_your_team,
    effectiveSectionState.pricing_options,
    effectiveSectionState.project_visualization,
    effectiveSectionState.scope_of_work,
    selectedLineItemIds,
    selectedPricingOptionId,
    selectedTeamIds,
    teamMembers,
    textColor,
    portalLink,
    portalLinkLoading,
    isEstimateAlreadyApproved,
    currentSettings?.version_warranty_enabled,
    presentationApprovalDocuments,
    openApprovalDocumentPreview,
  ]);

  const resolveClientPortalLink = async () => {
    const customerId = estimate?.customer?.id;
    if (!customerId) throw new Error("No customer associated with this estimate");

    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("client_portal_token")
      .eq("id", customerId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let token = customer?.client_portal_token || null;
    if (!token) {
      token = crypto.randomUUID();
      const { error: updateError } = await supabase
        .from("customers")
        .update({ client_portal_token: token })
        .eq("id", customerId);
      if (updateError) throw updateError;
    }

    return buildClientPortalShareUrl(token, {
      customDomain: estimate?.account?.settings?.website?.custom_domain ?? null,
    });
  };

  const ensurePortalLink = async () => {
    if (portalLink || portalLinkLoading) return;
    setPortalLinkLoading(true);
    try {
      const link = await resolveClientPortalLink();
      setPortalLink(link);
    } catch {
      toast.error("Failed to generate portal link");
    } finally {
      setPortalLinkLoading(false);
    }
  };

  const startPresenting = () => {
    setActiveSlide(0);
    setHasSignature(false);
    isDrawingSignatureRef.current = false;
    lastPointRef.current = null;
    setIsPresenting(true);
    void ensurePortalLink();
  };

  const finishPresentation = () => {
    setIsPresenting(false);
  };

  const handleApproveFromPresentation = async () => {
    if (!estimate?.id || !hasSignature || approving) return;

    setApproving(true);
    try {
      const signatureDataUrl = signatureCanvasRef.current?.toDataURL("image/png");
      await approveEstimateManuallyById(estimate.id, signatureDataUrl);
      await onRefresh();
      toast.success("Estimate approved");
      await ensurePortalLink();
      const qrSlideIndex = slides.findIndex((slide) => slide.key === "client_portal_qr");
      if (qrSlideIndex >= 0) {
        setActiveSlide(qrSlideIndex);
      } else {
        setIsPresenting(false);
      }
    } catch {
      toast.error("Failed to approve estimate");
    } finally {
      setApproving(false);
    }
  };

  const handleToggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    } catch {
      toast.error("Unable to toggle fullscreen mode");
    }
  };

  const handleExportPdf = () => {
    toast.info("Export PDF will be available here next.");
  };


  const handlePresentationNext = async () => {
    const currentSlideKey = slides[activeSlide]?.key;
    const nextSlideKey = slides[activeSlide + 1]?.key;
    if (currentSlideKey === "pricing_options" && nextSlideKey === "agreements_and_signatures" && !selectedPricingOptionId) {
      toast.error("Select a pricing option before continuing.");
      return;
    }

    setActiveSlide((value) => Math.min(value + 1, slides.length - 1));
  };

  useEffect(() => {
    if (!isPresenting) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isPresenting]);

  const loadBeforePhotos = useCallback(async () => {
    const leadId = estimate?.job_id;
    if (!leadId) {
      setBeforePhotos([]);
      return;
    }

    const { data, error } = await supabase
      .from("lead_photos")
      .select("file_path")
      .eq("lead_id", leadId)
      .eq("photo_type", "before")
      .order("created_at", { ascending: true })
      .limit(12);

    if (error) {
      setBeforePhotos([]);
      return;
    }

    const nextPhotos = (data || [])
      .map((photo: any) => ({
        filePath: String(photo.file_path || ""),
        url: supabase.storage.from("lead-photos").getPublicUrl(photo.file_path).data.publicUrl,
      }))
      .filter((photo) => photo.filePath && photo.url);
    setBeforePhotos(nextPhotos);
  }, [estimate?.job_id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await loadBeforePhotos();
      if (cancelled) return;
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadBeforePhotos]);

  const handleUploadBeforePhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isProposalLocked) return;
    const files = Array.from(event.target.files || []);
    const leadId = estimate?.job_id;
    if (files.length === 0 || !leadId || !currentAccount?.id || !user?.id) return;

    setUploadingBeforePhotos(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${currentAccount.id}/${leadId}/before/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("lead-photos")
          .upload(filePath, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("lead_photos").insert({
          lead_id: leadId,
          account_id: currentAccount.id,
          file_path: filePath,
          uploaded_by: user.id,
          photo_type: "before",
        });
        if (insertError) {
          await supabase.storage.from("lead-photos").remove([filePath]);
          throw insertError;
        }
      }

      await loadBeforePhotos();
      toast.success("Before photos uploaded");
    } catch {
      toast.error("Failed to upload before photos");
    } finally {
      setUploadingBeforePhotos(false);
      event.target.value = "";
    }
  };

  const toggleBeforePhotoDisplay = (filePath: string, checked: boolean) => {
    if (isProposalLocked) return;
    const next = new Set(selectedBeforePhotoPaths);
    if (checked) next.add(filePath);
    else next.delete(filePath);
    void saveProposal({
      ...currentSettings,
      before_photo_file_paths: Array.from(next),
    });
  };

  const ensureChecklistItem = async (label: string, description: string) => {
    if (isProposalLocked) return false;
    if (!estimate?.job_id) {
      toast.error("Scope sync requires a linked job");
      return false;
    }
    const exists = checklistItems.some((item) => item.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (exists) {
      toast.error("A scope task with that name already exists");
      return false;
    }
    await addItem.mutateAsync({
      label,
      sort_order: checklistItems.length,
      metadata: buildScopeItemMetadata({ category: "task" }, description),
    });
    toast.success("Added to job tasks");
    return true;
  };

  const removeChecklistItem = async (id: string) => {
    if (isProposalLocked) return;
    await deleteItem.mutateAsync(id);
    toast.success("Removed from job tasks");
  };

  const updateChecklistItem = async (
    id: string,
    nextLabel: string,
    nextDescription: string,
    existingItem: any,
  ) => {
    if (isProposalLocked) return;
    const trimmed = nextLabel.trim();
    const previousTrimmed = String(existingItem?.label || "").trim();
    const previousDescription = getScopeItemDescription(existingItem);
    const trimmedDescription = nextDescription.trim();
    if (!trimmed) return;
    if (trimmed === previousTrimmed && trimmedDescription === previousDescription) return;

    const duplicate = checklistItems.some(
      (item) => item.id !== id && item.label.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      toast.error("A scope task with that name already exists");
      return;
    }

    await updateItem.mutateAsync({
      id,
      label: trimmed,
      metadata: buildScopeItemMetadata(existingItem?.metadata, trimmedDescription),
    });
    toast.success("Scope task updated");
  };

  const openAddScopeItemDialog = () => {
    if (isProposalLocked) return;
    setEditingScopeItemId(null);
    setScopeItemDraftLabel("");
    setScopeItemDraftDescription("");
    setScopeItemDialogOpen(true);
  };

  const openEditScopeItemDialog = (id: string, label: string, description: string) => {
    if (isProposalLocked) return;
    setEditingScopeItemId(id);
    setScopeItemDraftLabel(label);
    setScopeItemDraftDescription(description);
    setScopeItemDialogOpen(true);
  };

  const saveScopeItemFromDialog = async () => {
    if (isProposalLocked) return;
    const nextLabel = scopeItemDraftLabel.trim();
    const nextDescription = scopeItemDraftDescription.trim();
    if (!nextLabel) {
      toast.error("Enter a scope item name");
      return;
    }

    if (editingScopeItemId) {
      const existingItem = checklistItems.find((item) => item.id === editingScopeItemId);
      if (!existingItem) {
        toast.error("Scope task no longer exists");
        return;
      }
      await updateChecklistItem(editingScopeItemId, nextLabel, nextDescription, existingItem);
      setScopeItemDialogOpen(false);
      return;
    }

    const added = await ensureChecklistItem(nextLabel, nextDescription);
    if (added) {
      setScopeItemDialogOpen(false);
    }
  };

  const handleGenerateScopeOfWork = async () => {
    if (isProposalLocked) return;
    const input = rawScopeDescription.trim();
    if (!input) {
      toast.error("Paste a labor description first");
      return;
    }
    if (!estimate?.job_id) {
      toast.error("Scope generation requires a linked job");
      return;
    }

    setGeneratingScope(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scope-of-work", {
        body: { laborDescription: input },
      });
      if (error) throw error;

      const generatedTasks = Array.isArray(data?.tasks)
        ? data.tasks
            .map((task: unknown) => (typeof task === "string" ? task.trim() : ""))
            .filter((task: string) => task.length > 0)
        : [];

      if (generatedTasks.length === 0) {
        toast.error("No tasks were generated");
        return;
      }

      const existing = new Set(checklistItems.map((item) => item.label.trim().toLowerCase()));
      let sortOrder = checklistItems.length;
      let added = 0;

      for (const task of generatedTasks) {
        const key = task.toLowerCase();
        if (existing.has(key)) continue;
        await addItem.mutateAsync({
          label: task,
          sort_order: sortOrder,
          metadata: { category: "task", generated_by: "scope_generator" },
        });
        existing.add(key);
        sortOrder += 1;
        added += 1;
      }

      if (added === 0) {
        toast.info("All generated tasks already exist");
      } else {
        toast.success(`Added ${added} scope task${added === 1 ? "" : "s"}`);
      }

      setScopeGeneratorOpen(false);
      setRawScopeDescription("");
    } catch {
      toast.error("Failed to generate scope of work");
    } finally {
      setGeneratingScope(false);
    }
  };

  const isLastSlide = activeSlide === slides.length - 1;
  const isCoverSlide = slides[activeSlide]?.key === "cover_page";
  const isPricingSlide = slides[activeSlide]?.key === "pricing_options";
  const isApprovalSlide = slides[activeSlide]?.key === "agreements_and_signatures";
  const isPortalQrSlide = slides[activeSlide]?.key === "client_portal_qr";

  return (
    <div className="card-elevated rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Project Proposal</h3>
          </div>
          {isProposalLocked ? (
            <p className="text-xs text-muted-foreground">Proposal editing is locked because this estimate is approved.</p>
          ) : null}
        </div>
        <Button variant="default" size="sm" onClick={startPresenting} className="gap-2" disabled={!hasGeneratedAgreements}>
          <Presentation className="h-4 w-4" />
          Present Now
        </Button>
      </div>

      <Accordion
        type="single"
        collapsible
        value={openEditorSection}
        onValueChange={setOpenEditorSection}
        className={`rounded border border-border ${isProposalLocked ? "pointer-events-none opacity-70" : ""}`}
      >
        {SECTIONS.filter((section) => section.key !== "agreements_and_signatures").map((section) => (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger className="px-4 py-3">
              <div className="flex items-center gap-3 text-left">
                <Checkbox
                  checked={effectiveSectionState[section.key]}
                  onCheckedChange={(checked) => {
                    const nextChecked = Boolean(checked);
                    if (nextChecked && !sectionAvailability[section.key]) {
                      return;
                    }
                    updateSection(section.key, nextChecked);
                    if (nextChecked) {
                      setOpenEditorSection(section.key);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  disabled={saving || (!sectionAvailability[section.key] && !effectiveSectionState[section.key])}
                />
                <div className="min-w-0">
                  <span className={effectiveSectionState[section.key] ? "" : "text-muted-foreground"}>{section.label}</span>
                  {!sectionAvailability[section.key] ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:mt-0 sm:ml-1 sm:inline">
                      ({sectionDisabledReason[section.key]})
                    </span>
                  ) : null}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              <div className="space-y-3">
                {section.key === "cover_page" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cover Title</p>
                    <Input
                      defaultValue={currentSettings.title || estimate?.job?.name || ""}
                      onBlur={(event) => updateTitle(event.target.value.trim())}
                      placeholder="Project proposal title"
                      disabled={!effectiveSectionState.cover_page}
                    />
                  </>
                ) : null}

                {section.key === "scope_of_work" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope of Work (syncs with job tasks)</p>
                    <div className="rounded border border-border divide-y">
                      {checklistItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p>{item.label}</p>
                            {getScopeItemDescription(item) ? (
                              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{getScopeItemDescription(item)}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => openEditScopeItemDialog(item.id, item.label, getScopeItemDescription(item))}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void removeChecklistItem(item.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      {checklistItems.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No tasks found.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAddScopeItemDialog}
                        className="gap-2"
                      >
                        <CheckSquare className="h-4 w-4" />
                        Add Scope Item
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setScopeGeneratorOpen(true)} disabled={isFreePlan}>
                        {isFreePlan ? "Generate Scope Of Work (Basic+)" : "Generate Scope Of Work"}
                      </Button>
                    </div>
                  </>
                ) : null}

                {section.key === "meet_your_team" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Meet Your Team</p>
                    <a
                      href="/settings/crew"
                      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      <Settings className="h-4 w-4" />
                      Crew Management Settings
                    </a>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {teamMembers.map((member) => (
                        <label key={member.user_id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedTeamIds.has(member.user_id)}
                            onCheckedChange={(checked) => toggleTeamMember(member.user_id, Boolean(checked))}
                          />
                          {member.full_name}
                        </label>
                      ))}
                    </div>
                  </>
                ) : null}

                {section.key === "materials" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Materials Highlights</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {materialOptions.map((item: any) => (
                        <div key={item.key} className="rounded border border-border p-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedLineItemIds.has(item.key)}
                              onCheckedChange={(checked) => toggleHighlightLineItem(item.key, Boolean(checked))}
                            />
                            {item.name}
                          </label>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 rounded-md border border-input px-2 py-1 text-xs cursor-pointer hover:bg-muted/40">
                              <Upload className="h-3.5 w-3.5" />
                              {uploadingMaterialId === item.key ? "Uploading..." : "Upload image"}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(event) => void handleUploadMaterialImage(item.key, event)}
                                disabled={uploadingMaterialId === item.key}
                              />
                            </label>
                            {materialImageMap[item.key] ? (
                              <img
                                src={materialImageMap[item.key]}
                                alt={`${item.name} preview`}
                                className="h-10 w-10 rounded border border-border object-cover"
                              />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                {section.key === "project_visualization" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project Visualization</p>
                    <label
                      className={`inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm ${
                        isFreePlan || uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40"
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      {isFreePlan ? "Upload images (Basic+)" : uploading ? "Uploading..." : "Upload images"}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleUploadVisualization}
                        disabled={isFreePlan || uploading}
                      />
                    </label>
                    {visualizationPhotos.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {visualizationPhotos.map((url, index) => (
                            <div key={`${url}-${index}`} className="flex items-center gap-2 rounded border border-border p-2">
                              <img
                                src={url}
                                alt={`Visualization ${index + 1}`}
                                className="h-10 w-10 rounded border border-border object-cover"
                              />
                              <span className="flex-1 text-sm">Image {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => void handleRemoveVisualizationPhoto(url)}
                                disabled={saving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {beforePhotos.length > 0 ? (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Before Photos To Display</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {beforePhotos.map((photo, index) => (
                            <label key={photo.filePath} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                              <Checkbox
                                checked={selectedBeforePhotoPaths.has(photo.filePath)}
                                onCheckedChange={(checked) => toggleBeforePhotoDisplay(photo.filePath, Boolean(checked))}
                              />
                              <img
                                src={photo.url}
                                alt={`Before photo ${index + 1}`}
                                className="h-10 w-10 rounded border border-border object-cover"
                              />
                              <span>Before Photo {index + 1}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="pt-2">
                      <label
                        className={`inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm ${
                          isProposalLocked || uploadingBeforePhotos || !estimate?.job_id
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:bg-muted/40"
                        }`}
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingBeforePhotos ? "Uploading..." : "Upload before photos"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleUploadBeforePhotos}
                          disabled={isProposalLocked || uploadingBeforePhotos || !estimate?.job_id}
                        />
                      </label>
                    </div>
                  </>
                ) : null}

                {section.key === "pricing_options" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended Option</p>
                    <Select
                      value={currentSettings?.recommended_version_id || "__none__"}
                      onValueChange={updateRecommendedVersion}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {estimateVersions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            {version.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Version Descriptions</p>
                    <div className="space-y-2">
                      {estimateVersions.map((version) => (
                        <div key={version.id} className="rounded border border-border p-3 space-y-2">
                          <p className="text-sm font-medium">{version.name}</p>
                          <Input
                            defaultValue={currentSettings?.version_subtitles?.[version.id] || ""}
                            onBlur={(event) => updateVersionSubtitle(version.id, event.target.value)}
                            placeholder="Add subtitle (shown in accent color)"
                          />
                          <Textarea
                            defaultValue={currentSettings?.version_descriptions?.[version.id] || ""}
                            onBlur={(event) => updateVersionDescription(version.id, event.target.value)}
                            rows={3}
                            placeholder="Add custom description for this pricing option"
                          />
                        </div>
                      ))}
                      {estimateVersions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No estimate versions available yet.</p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {section.key === "agreements_and_signatures" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimate Payment Schedule</p>
                    <a
                      href="/settings/pricing-rules#default-payment-schedule"
                      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      <Settings className="h-4 w-4" />
                      Edit Default Payment Schedule
                    </a>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Deposit %</p>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={customDepositPercentage}
                          onChange={(event) => setCustomDepositPercentage(event.target.value)}
                          onBlur={saveCustomPaymentSchedule}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Midpoint %</p>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={customMidpointPercentage}
                          onChange={(event) => setCustomMidpointPercentage(event.target.value)}
                          onBlur={saveCustomPaymentSchedule}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Final %</p>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={customFinalPercentage}
                          onChange={(event) => setCustomFinalPercentage(event.target.value)}
                          onBlur={saveCustomPaymentSchedule}
                        />
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pricing Option For Preview</p>
                    <Select
                      value={selectedPricingOptionId || estimateVersions[0]?.id}
                      onValueChange={setSelectedPricingOptionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a pricing option" />
                      </SelectTrigger>
                      <SelectContent>
                        {estimateVersions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            {version.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isWarrantyEnabledForActiveVersion}
                        onCheckedChange={(checked) => saveWarrantyEnabledForActiveVersion(Boolean(checked))}
                      />
                      Include warranty for selected pricing option
                    </label>
                    {isWarrantyEnabledForActiveVersion ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Warranty Length For Selected Pricing Option</p>
                        <Input
                          value={customWarrantyLength}
                          onChange={(event) => setCustomWarrantyLength(event.target.value)}
                          onBlur={saveCustomWarrantyLength}
                          placeholder="e.g., 2 years"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {showPreview && (
        <div
          className="rounded-lg border p-4 space-y-4"
          style={{
            fontFamily: bodyFont?.css || "inherit",
            background: "linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)",
          }}
        >
          {effectiveSectionState.cover_page && (
            <div className="rounded-lg p-4" style={{ backgroundColor: primaryColor, color: textColor }}>
              {estimate?.account?.logo_url ? <img src={estimate.account.logo_url} alt="Company logo" className="h-10 mb-3" /> : null}
              <h4 style={{ fontFamily: headingFont?.css || "inherit" }} className="text-2xl font-bold">
                {currentSettings.title || estimate?.job?.name || "Project"}
              </h4>
              <p className="text-sm opacity-90">{estimate?.account?.company_name || "Company"}</p>
            </div>
          )}
          {effectiveSectionState.scope_of_work && (
            <div>
              <h5 className="font-semibold mb-2">Scope of Work</h5>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {checklistItems.map((item) => (
                  <li key={item.id}>
                    {item.label}
                    {getScopeItemDescription(item) ? (
                      <p className="mt-0.5 list-none text-xs text-muted-foreground">{getScopeItemDescription(item)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {effectiveSectionState.pricing_options && estimateVersions.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Pricing Options</h5>
              <div className="grid sm:grid-cols-2 gap-2">
                {estimateVersions.map((version) => (
                  <div key={version.id} className="rounded border border-border bg-white p-3">
                    <p className="text-sm font-medium">{version.name}</p>
                    {currentSettings?.version_subtitles?.[version.id] ? (
                      <p className="text-sm font-bold italic" style={{ color: accentColor }}>
                        {currentSettings.version_subtitles[version.id]}
                      </p>
                    ) : null}
                    <p className="text-xl font-bold">${Number(version.total).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isPresenting &&
        slides.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed left-0 top-0 z-[100] h-dvh w-screen"
            style={{
              fontFamily: bodyFont?.css || "inherit",
              backgroundColor: isCoverSlide ? primaryColor : "#ffffff",
            }}
          >
            <div className="flex h-dvh flex-col">
              <div
                className="flex items-center justify-between border-b border-white/10 px-6 py-4"
                style={{ backgroundColor: primaryColor }}
              >
                <div />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 bg-white/10 text-slate-100 hover:bg-white/20"
                    onClick={handleExportPdf}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Export PDF
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 w-12 bg-white/15 p-0 text-slate-100 hover:bg-white/25"
                    onClick={() => void handleToggleBrowserFullscreen()}
                  >
                    {isBrowserFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 w-12 bg-white/10 p-0 text-slate-100 hover:bg-white/20"
                    onClick={() => setIsPresenting(false)}
                    aria-label="Exit presentation"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">{slides[activeSlide].content}</div>

              <div
                className="flex items-center justify-between border-t border-white/10 px-6 py-4"
                style={{ backgroundColor: primaryColor }}
              >
                {isApprovalSlide ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveSlide((value) => Math.max(value - 1, 0))}
                      disabled={activeSlide === 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    {isEstimateAlreadyApproved ? (
                      <Button
                        onClick={() => setActiveSlide((value) => Math.min(value + 1, slides.length - 1))}
                        disabled={activeSlide === slides.length - 1}
                        className="gap-2"
                        style={{ backgroundColor: primaryColor, color: textColor }}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void handleApproveFromPresentation()}
                        disabled={!hasSignature || approving}
                        style={{ backgroundColor: primaryColor, color: textColor }}
                      >
                        {approving ? "Approving..." : "Approve"}
                      </Button>
                    )}
                  </>
                ) : isPortalQrSlide ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveSlide((value) => Math.max(value - 1, 0))}
                      disabled={activeSlide === 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={finishPresentation}
                      style={{ backgroundColor: primaryColor, color: textColor }}
                    >
                      Done
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveSlide((value) => Math.max(value - 1, 0))}
                      disabled={activeSlide === 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={() => void handlePresentationNext()}
                      disabled={isLastSlide || advancingFromPricing || (isPricingSlide && !selectedPricingOptionId)}
                      className="gap-2"
                      style={{ backgroundColor: primaryColor, color: textColor }}
                    >
                      {advancingFromPricing ? "Saving..." : "Next"}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Dialog open={Boolean(selectedDocumentPreview)} onOpenChange={(open) => !open && setSelectedDocumentPreview(null)}>
        <DialogContent className="z-[130]">
          <DialogHeader>
            <DialogTitle>{selectedDocumentPreview?.title || "Agreement"}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm max-w-none leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-1 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-9 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/20 p-4"
            dangerouslySetInnerHTML={{
              __html: renderDocumentTemplateMarkdownHtml(selectedDocumentPreview?.content || "No document text available."),
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={scopeGeneratorOpen} onOpenChange={setScopeGeneratorOpen}>
        <DialogContent className="z-[130]">
          <DialogHeader>
            <DialogTitle>Generate Scope Of Work</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste a raw labor description and GPT will generate checklist tasks for this proposal.
            </p>
            <Textarea
              value={rawScopeDescription}
              onChange={(event) => setRawScopeDescription(event.target.value)}
              rows={10}
              placeholder="Example: Demo existing patio, excavate 6 inches, compact subgrade, install base, set pavers, edge restraint, polymeric sand, cleanup..."
            />
            <div className="flex justify-end">
              <Button onClick={() => void handleGenerateScopeOfWork()} disabled={generatingScope}>
                {generatingScope ? "Generating..." : "Generate Tasks"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scopeItemDialogOpen} onOpenChange={setScopeItemDialogOpen}>
        <DialogContent className="z-[130]">
          <DialogHeader>
            <DialogTitle>{editingScopeItemId ? "Edit Scope Item" : "Add Scope Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {editingScopeItemId ? "Update the scope task details." : "Add a scope task name and optional description."}
            </p>
            <Input
              value={scopeItemDraftLabel}
              onChange={(event) => setScopeItemDraftLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveScopeItemFromDialog();
                }
              }}
              placeholder="e.g. Demolition and debris removal"
            />
            <Textarea
              value={scopeItemDraftDescription}
              onChange={(event) => setScopeItemDraftDescription(event.target.value)}
              rows={3}
              placeholder="Optional description (e.g. Haul debris to approved dump site)"
            />
            <div className="flex justify-end">
              <Button onClick={() => void saveScopeItemFromDialog()} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {editingScopeItemId ? "Save" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
