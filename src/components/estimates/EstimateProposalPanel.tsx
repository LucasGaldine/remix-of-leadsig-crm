import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Package, Presentation, Upload, X } from "lucide-react";
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
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useJobChecklist } from "@/hooks/useJobChecklist";
import { getBrandFontOption, loadGoogleBrandFont } from "@/lib/brandFonts";
import { approveEstimateManuallyById } from "@/lib/estimateApproval";
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

const AGREEMENT_KEYS = [
  "job_release_agreement",
  "job_agreement",
  "warranty_agreement",
] as const;

const AGREEMENT_LABELS: Record<(typeof AGREEMENT_KEYS)[number], string> = {
  job_release_agreement: "Job Release Agreement",
  job_agreement: "Job Agreement",
  warranty_agreement: "Warranty Agreement",
};

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
  const SIGNATURE_CANVAS_WIDTH = 600;
  const SIGNATURE_CANVAS_HEIGHT = 180;
  const isTestMode = import.meta.env.MODE === "test";
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMaterialId, setUploadingMaterialId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [openEditorSection, setOpenEditorSection] = useState<string>("");
  const [selectedAgreementKey, setSelectedAgreementKey] = useState<(typeof AGREEMENT_KEYS)[number] | null>(null);
  const [approving, setApproving] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [scopeGeneratorOpen, setScopeGeneratorOpen] = useState(false);
  const [rawScopeDescription, setRawScopeDescription] = useState("");
  const [generatingScope, setGeneratingScope] = useState(false);
  const [agreementDrafts, setAgreementDrafts] = useState<Record<string, string>>({});
  const [beforePhotos, setBeforePhotos] = useState<Array<{ filePath: string; url: string }>>([]);
  const [activeVisualizationIndex, setActiveVisualizationIndex] = useState(0);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingSignatureRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const teamMembersQuery = isTestMode ? ({ data: [] } as any) : useTeamMembers();
  const checklistQuery = isTestMode
    ? ({
        items: [],
        addItem: { mutateAsync: async () => undefined },
        deleteItem: { mutateAsync: async () => undefined },
      } as any)
    : useJobChecklist(estimate?.job_id || undefined);
  const teamMembers = teamMembersQuery.data || [];
  const checklistItems = checklistQuery.items || [];
  const addItem = checklistQuery.addItem;
  const deleteItem = checklistQuery.deleteItem;

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
  const websiteSettings = estimate?.account?.settings?.website || {};
  const headingFont = getBrandFontOption(websiteSettings?.font);
  const bodyFont = getBrandFontOption(websiteSettings?.body_font);
  loadGoogleBrandFont(headingFont);
  loadGoogleBrandFont(bodyFont);
  const primaryColor = estimate?.account?.settings?.client_portal_color || "#0f172a";
  const textColor = estimate?.account?.settings?.client_portal_text_color || "#ffffff";
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

  const getContractorAddress = () => {
    const accountSettings = estimate?.account?.settings;
    const settingsAddressCandidates = [
      accountSettings?.company_address,
      accountSettings?.business_address,
      accountSettings?.address,
      accountSettings?.website?.company_address,
      accountSettings?.website?.business_address,
      accountSettings?.website?.address,
    ];
    for (const candidate of settingsAddressCandidates) {
      const value = typeof candidate === "string" ? candidate.trim() : "";
      if (value) return value;
    }
    return "Address on file";
  };

  const buildJobReleaseAgreement = () => {
    const contractorName = (estimate?.account?.company_name || "Contractor").trim();
    const contractorAddress = getContractorAddress();
    const contractorPhone = (estimate?.account?.company_phone || "N/A").trim() || "N/A";
    const contractorEmail = (estimate?.account?.company_email || "N/A").trim() || "N/A";
    const clientName = (estimate?.customer?.name || "Client").trim();
    const projectName = displayCoverTitle || estimate?.job?.name || "Project";
    const projectAddress =
      formatAddressWithCity(estimate?.job?.address || estimate?.customer?.address, estimate?.job?.city || estimate?.customer?.city)
      || "Address to be confirmed";

    const scopeItems = checklistItems
      .map((item) => String(item?.label || "").trim())
      .filter((value) => value.length > 0);

    const fallbackScopeItems = (displayLineItems || [])
      .map((item: any) => String(item?.name || "").trim())
      .filter((value: string) => value.length > 0);

    const finalScopeItems = (scopeItems.length > 0 ? scopeItems : fallbackScopeItems).slice(0, 25);
    const numberedScope = (finalScopeItems.length > 0 ? finalScopeItems : ["Scope details to be finalized in writing."])
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");

    const totalCost = Number(displayLineItems.reduce((sum, item: any) => sum + (Number(item?.total) || 0), 0)) || 0;
    const depositPercentage = 33;
    const midpointPercentage = 33;
    const finalPercentage = 34;
    const depositAmount = Number((totalCost * (depositPercentage / 100)).toFixed(2));
    const midpointAmount = Number((totalCost * (midpointPercentage / 100)).toFixed(2));
    const finalAmount = Number((totalCost - depositAmount - midpointAmount).toFixed(2));

    const paymentMethod = estimate?.account?.settings?.stripe_account_id ? "Stripe" : "Check or ACH";
    const workHours = "Monday-Friday, 7:00 AM - 6:00 PM";

    return `JOB RELEASE AGREEMENT

Date: ${todayIso}

PARTIES

Contractor: ${contractorName}
Address: ${contractorAddress}
Phone: ${contractorPhone}
Email: ${contractorEmail}

Client: ${clientName}
Project Name: ${projectName}
Project Address: ${projectAddress}

AUTHORIZATION TO PROCEED

The Client hereby authorizes ${contractorName} (“Contractor”) to begin work on the project described below. By signing this Job Release Agreement, the Client agrees to the following terms and conditions.

PROJECT SCOPE

We are pleased to provide the following scope of work:

${numberedScope}

The Contractor agrees to complete the work in a professional and workmanlike manner, maintaining a clean and safe job site throughout the duration of the project.

FINANCIAL TERMS

Total Project Cost: $${formatCurrency(totalCost)}

Payment Schedule:

Deposit (${depositPercentage}%): $${formatCurrency(depositAmount)} — due upon signing
Midpoint Payment (${midpointPercentage}%): $${formatCurrency(midpointAmount)} — due at project midpoint
Final Payment (${finalPercentage}%): $${formatCurrency(finalAmount)} — due upon completion

Payment Method: ${paymentMethod} (e.g., Stripe, check, ACH)

Work will commence only after the initial deposit has been received.

SITE ACCESS

The Client agrees to provide the Contractor with full and unobstructed access to the project site during regular business hours:

Hours: ${workHours} (e.g., Monday–Friday, 7:00 AM – 6:00 PM)

INSURANCE

The Contractor shall maintain appropriate insurance coverage, including:

General Liability Insurance
Workers’ Compensation Insurance

Coverage will remain active for the duration of the project and apply to all employees and subcontractors.

ACKNOWLEDGMENT

The Client confirms that:

The scope of work is accurate and understood
The pricing and payment schedule are agreed upon
Authorization is granted to begin work upon deposit receipt
SIGNATURES

Client Signature: ___________________________
Printed Name: ${clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${contractorName}
Date: _______________`;
  };

  const buildJobAgreement = () => {
    const contractorName = (estimate?.account?.company_name || "Contractor").trim();
    const contractorAddress = getContractorAddress();
    const contractorPhone = (estimate?.account?.company_phone || "N/A").trim() || "N/A";
    const contractorEmail = (estimate?.account?.company_email || "N/A").trim() || "N/A";
    const clientName = (estimate?.customer?.name || "Client").trim();
    const projectName = displayCoverTitle || estimate?.job?.name || "Project";
    const projectAddress =
      formatAddressWithCity(estimate?.job?.address || estimate?.customer?.address, estimate?.job?.city || estimate?.customer?.city)
      || "Address to be confirmed";

    const scopeItems = checklistItems
      .map((item) => String(item?.label || "").trim())
      .filter((value) => value.length > 0);
    const fallbackScopeItems = (displayLineItems || [])
      .map((item: any) => String(item?.name || "").trim())
      .filter((value: string) => value.length > 0);
    const finalScopeItems = (scopeItems.length > 0 ? scopeItems : fallbackScopeItems).slice(0, 25);
    const numberedScope = (finalScopeItems.length > 0 ? finalScopeItems : ["Scope details to be finalized in writing."])
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");

    const totalCost = Number(displayLineItems.reduce((sum, item: any) => sum + (Number(item?.total) || 0), 0)) || 0;
    const depositPercentage = 33;
    const midpointPercentage = 33;
    const finalPercentage = 34;
    const depositAmount = Number((totalCost * (depositPercentage / 100)).toFixed(2));
    const midpointAmount = Number((totalCost * (midpointPercentage / 100)).toFixed(2));
    const finalAmount = Number((totalCost - depositAmount - midpointAmount).toFixed(2));

    const paymentMethod = estimate?.account?.settings?.stripe_account_id ? "Stripe" : "Check or ACH";
    const workHours = "Monday-Friday, 7:00 AM - 6:00 PM";
    const startDate = estimate?.job?.scheduled_date || todayIso;
    const completionDate = estimate?.job?.last_scheduled_date || startDate;
    const permitResponsibilityOverride = `${contractorName} will obtain all required permits unless stated otherwise in writing.`;
    const arbitrationBody = "American Arbitration Association";
    const jurisdiction = (estimate?.job?.city || estimate?.customer?.city || "Project jurisdiction").trim();
    const terminationNoticePeriod = "7 days";

    return `CONSTRUCTION CONTRACT / JOB AGREEMENT

Date: ${todayIso}

PARTIES

Contractor: ${contractorName}
Address: ${contractorAddress}
Phone: ${contractorPhone}
Email: ${contractorEmail}

Client: ${clientName}
Project Name: ${projectName}
Project Address: ${projectAddress}

This Construction Contract (“Agreement”) is entered into by and between ${contractorName} (“Contractor”) and ${clientName} (“Client”) for the project described below.

1. SCOPE OF WORK

The Contractor agrees to perform the following work:

${numberedScope}

All work shall be completed in a professional and workmanlike manner and in compliance with all applicable laws, codes, and regulations.

2. PROJECT TIMELINE
Estimated Start Date: ${startDate} (or upon deposit receipt)
Estimated Completion Date: ${completionDate}

The Contractor may adjust the schedule due to weather conditions, material availability, or unforeseen circumstances.

3. TOTAL CONTRACT PRICE

Total Cost: $${formatCurrency(totalCost)}

4. PAYMENT SCHEDULE

Payment shall be made as follows:

Deposit (${depositPercentage}%): $${formatCurrency(depositAmount)} — due upon signing
Midpoint Payment (${midpointPercentage}%): $${formatCurrency(midpointAmount)} — due at project midpoint
Final Payment (${finalPercentage}%): $${formatCurrency(finalAmount)} — due upon substantial completion

Payment Method: ${paymentMethod}

Failure to make payments on time may result in project delays or suspension of work.

5. CHANGE ORDERS

Any modifications to the scope of work must be documented in a written Change Order signed by both parties prior to execution.

Change Orders may affect cost and timeline
Verbal agreements are not binding
6. PERMITS AND INSPECTIONS

${contractorName} shall obtain all necessary permits and coordinate required inspections unless otherwise specified:

${permitResponsibilityOverride}

7. INSURANCE AND LIABILITY

The Contractor shall maintain:

General Liability Insurance
Workers’ Compensation Insurance

Coverage applies to all employees and subcontractors throughout the duration of the project.

8. SITE ACCESS

The Client agrees to:

Provide full access to the work site
Ensure the area is clear of obstacles

Work Hours: ${workHours} (e.g., Monday–Friday, 7:00 AM – 6:00 PM)

9. DISPUTE RESOLUTION

Any disputes arising from this Agreement shall be resolved through:

Method: Binding arbitration
Governing Body: American Arbitration Association (or ${arbitrationBody})
Location: ${jurisdiction}

The arbitrator’s decision shall be final and binding.

10. TERMINATION

Either party may terminate this Agreement with:

${terminationNoticePeriod} (e.g., 7 days) written notice

Upon termination:

The Client shall pay for all completed work and materials purchased
The Contractor shall cease work promptly
11. ENTIRE AGREEMENT

This document represents the full agreement between the parties and supersedes all prior discussions, agreements, or representations.

SIGNATURES

Client Signature: ___________________________
Printed Name: ${clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${contractorName}
Date: _______________`;
  };

  const buildWarrantyAgreement = () => {
    const contractorName = (estimate?.account?.company_name || "Contractor").trim();
    const contractorAddress = getContractorAddress();
    const contractorPhone = (estimate?.account?.company_phone || "N/A").trim() || "N/A";
    const contractorEmail = (estimate?.account?.company_email || "N/A").trim() || "N/A";
    const clientName = (estimate?.customer?.name || "Client").trim();
    const projectName = displayCoverTitle || estimate?.job?.name || "Project";
    const projectAddress =
      formatAddressWithCity(estimate?.job?.address || estimate?.customer?.address, estimate?.job?.city || estimate?.customer?.city)
      || "Address to be confirmed";

    const scopeItems = checklistItems
      .map((item) => String(item?.label || "").trim())
      .filter((value) => value.length > 0);
    const fallbackScopeItems = (displayLineItems || [])
      .map((item: any) => String(item?.name || "").trim())
      .filter((value: string) => value.length > 0);
    const finalScopeItems = (scopeItems.length > 0 ? scopeItems : fallbackScopeItems).slice(0, 25);
    const numberedScope = (finalScopeItems.length > 0 ? finalScopeItems : ["Scope details to be finalized in writing."])
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");

    const contractTotal = Number(displayLineItems.reduce((sum, item: any) => sum + (Number(item?.total) || 0), 0)) || 0;
    const workmanshipWarrantyDuration = "2 years";
    const materialWarrantyNotes = "Manufacturer warranty details available upon request.";
    const inspectionTimeframe = "14 business days";

    return `WARRANTY AGREEMENT

Date: ${todayIso}

PARTIES

Contractor: ${contractorName}
Address: ${contractorAddress}
Phone: ${contractorPhone}
Email: ${contractorEmail}

Client: ${clientName}
Project Name: ${projectName}
Project Address: ${projectAddress}

This Warranty Agreement (“Agreement”) is provided by ${contractorName} (“Contractor”) to ${clientName} (“Client”) in connection with the completed project at the address listed above.

1. WORKMANSHIP WARRANTY

The Contractor warrants all workmanship for a period of:

${workmanshipWarrantyDuration} (e.g., 2 years)

from the date of substantial completion.

During this period, the Contractor will repair or correct, at no additional cost to the Client, any defects in workmanship arising under normal use and conditions.

2. MATERIALS WARRANTY

All materials are subject to their respective manufacturer warranties.

Warranty terms vary by product
The Contractor will assist in submitting claims when applicable

Manufacturer Warranty Details (optional):
${materialWarrantyNotes}

3. SCOPE OF WARRANTY COVERAGE

This warranty applies to the following work:

${numberedScope}

4. EXCLUSIONS

This warranty does not cover:

Acts of God (e.g., floods, earthquakes, severe weather)
Misuse, neglect, or lack of proper maintenance
Normal wear and tear
Work altered or modified by others
Damage due to soil movement, settlement, or pre-existing structural conditions
5. WARRANTY CLAIM PROCESS

To submit a claim:

The Client must notify the Contractor in writing within the warranty period
The Contractor will inspect the issue within ${inspectionTimeframe} (e.g., 14 business days)
If covered, the Contractor will provide a repair or correction plan

Contact for Claims:
${contractorEmail} | ${contractorPhone}

6. LIMITATION OF LIABILITY

The Contractor’s total liability under this warranty shall not exceed:

$${formatCurrency(contractTotal)}

(as defined in the associated Construction Contract / Job Agreement)

SIGNATURES

Client Signature: ___________________________
Printed Name: ${clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${contractorName}
Date: _______________`;
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
    const templates = estimate?.agreement_templates && typeof estimate.agreement_templates === "object"
      ? estimate.agreement_templates
      : {};
    setAgreementDrafts({
      job_release_agreement: typeof templates.job_release_agreement === "string" ? templates.job_release_agreement : "",
      job_agreement: typeof templates.job_agreement === "string" ? templates.job_agreement : "",
      warranty_agreement: typeof templates.warranty_agreement === "string" ? templates.warranty_agreement : "",
    });
  }, [estimate?.id, estimate?.agreement_templates]);

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

  const handleUploadMaterialImage = async (lineItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
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

  const updateAgreementTemplate = (key: string, value: string) => {
    const currentTemplates = estimate?.agreement_templates || {};
    void saveProposal(currentSettings, {
      agreement_templates: { ...currentTemplates, [key]: value },
    });
  };

  const setAndPersistAgreementTemplate = (key: (typeof AGREEMENT_KEYS)[number], value: string) => {
    setAgreementDrafts((previous) => ({ ...previous, [key]: value }));
    updateAgreementTemplate(key, value);
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

  const updateRecommendedVersion = (versionId: string) => {
    const nextValue = versionId === "__none__" ? null : versionId;
    void saveProposal({
      ...currentSettings,
      recommended_version_id: nextValue,
    });
  };

  const slides = useMemo(() => {
    const list: Array<{ key: string; title: string; content: React.ReactNode }> = [];

    if (sectionState.cover_page) {
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

    if (sectionState.scope_of_work) {
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
                  <p className="text-3xl font-medium leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (sectionState.meet_your_team) {
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
                        <Avatar className="h-14 w-14 border border-border bg-background mb-3 mx-auto">
                          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={member.full_name} /> : null}
                          <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xl font-semibold">{member.full_name}</p>
                        {member.role ? (
                          <div className="mt-2 flex justify-center">
                            <Badge variant="secondary" className="text-xs font-medium">
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

    if (sectionState.materials) {
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

    if (sectionState.project_visualization) {
      list.push({
        key: "project_visualization",
        title: "Project Visualization",
        content: (
          <div className="rounded-lg bg-white p-8 min-h-[70vh] flex flex-col">
            <h3 className="text-3xl font-semibold mb-4">Project Visualization</h3>
            <div className="flex-1 flex flex-col justify-center">
              {visualizationPhotos.length > 0 ? (
                <div className="mx-auto w-full max-w-4xl max-h-[36vh] rounded-xl overflow-hidden border border-border bg-white">
                  <img
                    src={visualizationPhotos[Math.min(activeVisualizationIndex, visualizationPhotos.length - 1)]}
                    alt="Project visualization"
                    className="h-full w-full object-cover"
                  />
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
              {displayedBeforePhotoUrls.length > 0 ? (
                <div className="mt-8 mx-auto w-full max-w-5xl">
                  <h4 className="text-2xl font-semibold mb-4 text-center">Before Photos</h4>
                  <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                    {displayedBeforePhotoUrls.map((url, index) => (
                      <img
                        key={`before-${url}-${index}`}
                        src={url}
                        alt={`Before photo ${index + 1}`}
                        className="h-40 min-w-[16rem] rounded-lg border border-border object-cover snap-start"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ),
      });
    }

    if (sectionState.pricing_options) {
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
                    <div key={version.id} className="relative w-full max-w-[320px] rounded-2xl border border-border bg-muted/40 px-5 py-7 xl:basis-[320px]">
                      {currentSettings?.recommended_version_id === version.id ? (
                        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                          <Badge>Recommended</Badge>
                        </div>
                      ) : null}
                      <p className="text-2xl font-semibold text-center">{version.name}</p>
                      <p className="mt-2 text-4xl font-bold text-center">${Number(version.total).toLocaleString()}</p>
                      {currentSettings?.version_descriptions?.[version.id] ? (
                        <p className="mt-3 text-base text-center text-muted-foreground whitespace-pre-wrap">
                          {currentSettings.version_descriptions[version.id]}
                        </p>
                      ) : null}
                      {(() => {
                        const versionItems = Array.isArray(version?.line_items) ? version.line_items : [];
                        const highlightedItems = versionItems.filter((item: any) =>
                          highlightedLineItemNames.has(String(item?.name || "").trim().toLowerCase()),
                        );

                        return highlightedItems.length > 0 ? (
                          <ul className="mt-4 list-disc list-inside space-y-2 text-center">
                            {highlightedItems.map((item: any, index: number) => (
                              <li key={`${version.id}-${index}-${item?.name || "item"}`} className="text-lg font-semibold">
                                {item?.name || "Unnamed item"}
                              </li>
                            ))}
                          </ul>
                        ) : null;
                      })()}
                    </div>
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

    if (sectionState.agreements_and_signatures) {
      list.push({
        key: "agreements_and_signatures",
        title: "Agreements & Signatures",
        content: (
          <div className="rounded-lg bg-white p-8">
            <h3 className="text-3xl font-semibold mb-4">Agreements & Signatures</h3>
            <div className="space-y-4">
              {AGREEMENT_KEYS.map((key) => (
                <div key={key} className="rounded border border-border p-4">
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">{AGREEMENT_LABELS[key]}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setSelectedAgreementKey(key)}
                  >
                    View full agreement
                  </Button>
                </div>
              ))}
            </div>
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
              <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        ),
      });
    }

    return list;
  }, [
    checklistItems,
    currentSettings.title,
    displayLineItems,
    estimate?.account?.company_name,
    estimate?.account?.logo_url,
    estimate?.agreement_templates,
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
    sectionState.agreements_and_signatures,
    sectionState.cover_page,
    sectionState.materials,
    sectionState.meet_your_team,
    sectionState.pricing_options,
    sectionState.project_visualization,
    sectionState.scope_of_work,
    selectedLineItemIds,
    selectedTeamIds,
    teamMembers,
    textColor,
  ]);

  const startPresenting = () => {
    setActiveSlide(0);
    setIsPresenting(true);
  };

  const finishPresentation = () => {
    setIsPresenting(false);
  };

  const handleApproveFromPresentation = async () => {
    if (!estimate?.id || !hasSignature || approving) return;

    setApproving(true);
    try {
      await approveEstimateManuallyById(estimate.id);
      await onRefresh();
      toast.success("Estimate approved");
      setIsPresenting(false);
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

  useEffect(() => {
    const leadId = estimate?.job_id;
    if (!leadId) {
      setBeforePhotos([]);
      return;
    }

    let cancelled = false;
    const loadBeforePhotos = async () => {
      const { data, error } = await supabase
        .from("lead_photos")
        .select("file_path")
        .eq("lead_id", leadId)
        .eq("photo_type", "before")
        .order("created_at", { ascending: true })
        .limit(12);

      if (cancelled) return;
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
    };

    void loadBeforePhotos();
    return () => {
      cancelled = true;
    };
  }, [estimate?.job_id]);

  const toggleBeforePhotoDisplay = (filePath: string, checked: boolean) => {
    const next = new Set(selectedBeforePhotoPaths);
    if (checked) next.add(filePath);
    else next.delete(filePath);
    void saveProposal({
      ...currentSettings,
      before_photo_file_paths: Array.from(next),
    });
  };

  const ensureChecklistItem = async (label: string) => {
    if (!estimate?.job_id) {
      toast.error("Scope sync requires a linked job");
      return;
    }
    const exists = checklistItems.some((item) => item.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (exists) return;
    await addItem.mutateAsync({
      label,
      sort_order: checklistItems.length,
      metadata: { category: "task" },
    });
    toast.success("Added to job tasks");
  };

  const removeChecklistItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
    toast.success("Removed from job tasks");
  };

  const handleGenerateScopeOfWork = async () => {
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

  return (
    <div className="card-elevated rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Presentation className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Project Proposal</h3>
        </div>
        <Button variant="default" size="sm" onClick={startPresenting} className="gap-2">
          <Presentation className="h-4 w-4" />
          Present Now
        </Button>
      </div>

      <Accordion type="single" collapsible value={openEditorSection} onValueChange={setOpenEditorSection} className="rounded border border-border">
        {SECTIONS.map((section) => (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger
              className="px-4 py-3"
              onClick={(event) => {
                if (!sectionState[section.key]) {
                  event.preventDefault();
                }
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Checkbox
                  checked={sectionState[section.key]}
                  onCheckedChange={(checked) => {
                    const nextChecked = Boolean(checked);
                    updateSection(section.key, nextChecked);
                    if (nextChecked) {
                      setOpenEditorSection(section.key);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  disabled={saving}
                />
                <span className={sectionState[section.key] ? "" : "text-muted-foreground"}>{section.label}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              <div className={sectionState[section.key] ? "space-y-3" : "space-y-3 pointer-events-none opacity-50"}>
                {section.key === "cover_page" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cover Title</p>
                    <Input
                      defaultValue={currentSettings.title || estimate?.job?.name || ""}
                      onBlur={(event) => updateTitle(event.target.value.trim())}
                      placeholder="Project proposal title"
                      disabled={!sectionState.cover_page}
                    />
                  </>
                ) : null}

                {section.key === "scope_of_work" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope of Work (syncs with job tasks)</p>
                    <div className="rounded border border-border divide-y">
                      {checklistItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span>{item.label}</span>
                          <Button variant="ghost" size="sm" onClick={() => void removeChecklistItem(item.id)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                      {checklistItems.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No tasks found.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void ensureChecklistItem("New scope item")}
                        className="gap-2"
                      >
                        <CheckSquare className="h-4 w-4" />
                        Add Scope Item
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setScopeGeneratorOpen(true)}>
                        Generate Scope Of Work
                      </Button>
                    </div>
                  </>
                ) : null}

                {section.key === "meet_your_team" ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Meet Your Team</p>
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
                    <label className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <Upload className="h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload images"}
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleUploadVisualization} />
                    </label>
                    {estimate?.project_visualization_image_url ? (
                      <img
                        src={estimate.project_visualization_image_url}
                        alt="Project visualization"
                        className="max-h-56 rounded border border-border object-cover"
                      />
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Agreement Templates</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAndPersistAgreementTemplate("job_release_agreement", buildJobReleaseAgreement())}
                      >
                        Generate Job Release Agreement
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAndPersistAgreementTemplate("job_agreement", buildJobAgreement())}
                      >
                        Generate Job Agreement
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAndPersistAgreementTemplate("warranty_agreement", buildWarrantyAgreement())}
                      >
                        Generate Warranty Agreement
                      </Button>
                    </div>
                    {AGREEMENT_KEYS.map((key) => (
                      <div key={key} className="space-y-1">
                        <p className="text-xs font-medium">{key.replaceAll("_", " ")}</p>
                        <Textarea
                          value={agreementDrafts[key] || ""}
                          onChange={(event) =>
                            setAgreementDrafts((previous) => ({ ...previous, [key]: event.target.value }))
                          }
                          onBlur={() => updateAgreementTemplate(key, agreementDrafts[key] || "")}
                          rows={3}
                        />
                      </div>
                    ))}
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
          {sectionState.cover_page && (
            <div className="rounded-lg p-4" style={{ backgroundColor: primaryColor, color: textColor }}>
              {estimate?.account?.logo_url ? <img src={estimate.account.logo_url} alt="Company logo" className="h-10 mb-3" /> : null}
              <h4 style={{ fontFamily: headingFont?.css || "inherit" }} className="text-2xl font-bold">
                {currentSettings.title || estimate?.job?.name || "Project"}
              </h4>
              <p className="text-sm opacity-90">{estimate?.account?.company_name || "Company"}</p>
            </div>
          )}
          {sectionState.scope_of_work && (
            <div>
              <h5 className="font-semibold mb-2">Scope of Work</h5>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {checklistItems.map((item) => <li key={item.id}>{item.label}</li>)}
              </ul>
            </div>
          )}
          {sectionState.pricing_options && estimateVersions.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Pricing Options</h5>
              <div className="grid sm:grid-cols-2 gap-2">
                {estimateVersions.map((version) => (
                  <div key={version.id} className="rounded border border-border bg-white p-3">
                    <p className="text-sm font-medium">{version.name}</p>
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
                {isLastSlide ? (
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
                      onClick={() => void handleApproveFromPresentation()}
                      disabled={!hasSignature || approving}
                      style={{ backgroundColor: primaryColor, color: textColor }}
                    >
                      {approving ? "Approving..." : "Approve"}
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
                      onClick={() => setActiveSlide((value) => Math.min(value + 1, slides.length - 1))}
                      disabled={activeSlide === slides.length - 1}
                      className="gap-2"
                      style={{ backgroundColor: primaryColor, color: textColor }}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Dialog open={selectedAgreementKey !== null} onOpenChange={(open) => !open && setSelectedAgreementKey(null)}>
        <DialogContent className="z-[130]">
          <DialogHeader>
            <DialogTitle>{selectedAgreementKey ? AGREEMENT_LABELS[selectedAgreementKey] : "Agreement"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap">
            {selectedAgreementKey
              ? estimate?.agreement_templates?.[selectedAgreementKey]?.trim() || "No agreement text added yet."
              : ""}
          </div>
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
    </div>
  );
}
