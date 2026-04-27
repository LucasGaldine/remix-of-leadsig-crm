// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRightLeft, User, Calendar, Briefcase, ChevronRight, CircleAlert as AlertCircle, History, Pencil as Edit2, Link2, CheckCheck, CreditCard, Download, Check, FileText, Camera, Upload, X, Plus, EllipsisVertical, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useEstimate } from "@/hooks/useEstimates";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { generateEstimatePDF } from "@/lib/pdfGenerator";
import { EditEstimateModal } from "@/components/payments/EditEstimateModal";
import { JobInvoiceCard } from "@/components/jobs/JobInvoiceCard";
import { ClientPortalLinkDialog } from "@/components/shared/ClientPortalLinkDialog";
import { prepareLeadPhotoForUpload } from "@/lib/photoCompression";
import { createEstimateVersionSnapshot, isEstimateVersionsUnavailableError } from "@/lib/estimateVersions";
import { buildClientPortalShareUrl } from "@/lib/clientPortalUrl";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORY_ORDER = ["equipment", "materials", "labor", "other"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  equipment: "Equipment",
  materials: "Materials",
  labor: "Labor",
  other: "Other",
};

const normalizeCategory = (category?: string) =>
  CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])
    ? (category as (typeof CATEGORY_ORDER)[number])
    : "other";

const isManualApprovalPhotoColumnMissing = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const err = error as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : "";
  const status = typeof err.status === "number" ? err.status : null;
  const message = [err.message, err.details, err.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!message.includes("manual_approval_photo_url")) {
    return false;
  }

  return code === "PGRST204" || code === "42703" || status === 400 || message.includes("column");
};

const isEstimateVersionsUnavailable = (error: unknown) => isEstimateVersionsUnavailableError(error);

interface EstimateVersionSnapshotItem {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order?: number;
  category?: "equipment" | "materials" | "labor" | "other";
}

interface EstimateVersion {
  id: string;
  name: string;
  subtotal: number;
  tax_rate: number;
  tax: number;
  discount: number;
  total: number;
  profit_margin?: number;
  surcharge?: number;
  notes?: string | null;
  line_items: EstimateVersionSnapshotItem[];
  created_at: string;
  updated_at: string;
}

function foldProfitMarginIntoLineItems(
  lineItems: Array<{ total: number; quantity: number; unit_price: number } & Record<string, any>>,
  subtotal: number,
  profitMargin: number,
) {
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
      if (remainder <= 0) return;
      distributedCentsByIndex.set(entry.index, (distributedCentsByIndex.get(entry.index) || 0) + 1);
      remainder -= 1;
    });

  const adjustedLineItems = lineItems.map((item, index) => {
    const shareCents = distributedCentsByIndex.get(index) || 0;
    if (shareCents === 0) return item;

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


export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isManager, user, currentAccount } = useAuth();
  const { data: estimate, isLoading } = useEstimate(id);
  const isMobile = useIsMobile();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalCopied, setPortalCopied] = useState(false);
  const [portalClientPhone, setPortalClientPhone] = useState("");
  const [portalClientEmail, setPortalClientEmail] = useState("");
  const [manualApproving, setManualApproving] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showApprovedDetails, setShowApprovedDetails] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(() => new Set());
  const [manualApprovalPhoto, setManualApprovalPhoto] = useState<File | null>(null);
  const [manualApprovalPreviewUrl, setManualApprovalPreviewUrl] = useState<string | null>(null);
  const [estimateVersions, setEstimateVersions] = useState<EstimateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [openLogPaymentSignal, setOpenLogPaymentSignal] = useState(0);
  const [isCreatingVersionDraft, setIsCreatingVersionDraft] = useState(false);
  const [newVersionNameDraft, setNewVersionNameDraft] = useState("");
  const [renamingVersionId, setRenamingVersionId] = useState<string | null>(null);
  const [versionNameDrafts, setVersionNameDrafts] = useState<Record<string, string>>({});
  const uploadPhotoInputRef = useRef<HTMLInputElement>(null);
  const takePhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (manualApprovalPreviewUrl) {
        URL.revokeObjectURL(manualApprovalPreviewUrl);
      }
    };
  }, [manualApprovalPreviewUrl]);

  const fetchEstimateVersions = async () => {
    if (!id) return;

    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from("estimate_versions")
        .select(`
          id,
          name,
          subtotal,
          tax_rate,
          tax,
          discount,
          total,
          profit_margin,
          surcharge,
          notes,
          line_items,
          created_at,
          updated_at
        `)
        .eq("estimate_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        if (isEstimateVersionsUnavailable(error)) {
          setEstimateVersions([]);
          setVersionNameDrafts({});
          setSelectedVersionId(null);
          return;
        }
        throw error;
      }

      const versions = (data || []) as EstimateVersion[];
      setEstimateVersions(versions);
      setVersionNameDrafts(
        versions.reduce((acc, version) => {
          acc[version.id] = version.name;
          return acc;
        }, {} as Record<string, string>),
      );
      setSelectedVersionId((previous) => {
        if (previous && versions.some((version) => version.id === previous)) {
          return previous;
        }
        return versions[versions.length - 1]?.id || null;
      });
    } catch (error) {
      console.error("Failed to load estimate versions:", error);
      toast.error("Failed to load estimate versions");
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchEstimateVersions();
  }, [id]);

  const createEstimateVersion = async (nameOverride?: string): Promise<boolean> => {
    if (!estimate || !id) return false;

    const activeLineItems = estimate.line_items
      .filter((item: any) => !item.is_change_order || item.change_order_type !== "deleted")
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item: any, index: number) => ({
        name: item.name,
        description: item.description || null,
        quantity: Number(item.quantity) || 0,
        unit: item.unit,
        unit_price: Number(item.unit_price) || 0,
        total: Number(item.total) || 0,
        sort_order: Number(item.sort_order ?? index),
        category: normalizeCategory(item.category),
      }));

    const normalizedNameOverride =
      typeof nameOverride === "string" ? nameOverride : `Version ${estimateVersions.length + 1}`;
    const newVersionName = normalizedNameOverride.trim();

    if (!newVersionName) {
      toast.error("Version name is required");
      return false;
    }

    setCreatingVersion(true);
    try {
      const { unavailable } = await createEstimateVersionSnapshot({
        estimateId: id,
        accountId: estimate.account_id,
        name: newVersionName,
        subtotal: Number(estimate.subtotal) || 0,
        taxRate: Number(estimate.tax_rate) || 0,
        tax: Number(estimate.tax) || 0,
        discount: Number(estimate.discount) || 0,
        total: Number(estimate.total) || 0,
        profitMargin: Number((estimate as any).profit_margin) || 0,
        surcharge: Number((estimate as any).surcharge) || 0,
        notes: estimate.notes || null,
        lineItems: activeLineItems,
      });

      if (unavailable) {
        toast.error("Estimate versions are unavailable in this environment");
        return false;
      }

      await fetchEstimateVersions();
      toast.success("Version created");
      return true;
    } catch (error) {
      console.error("Failed to create estimate version:", error);
      toast.error("Failed to create version");
      return false;
    } finally {
      setCreatingVersion(false);
    }
  };

  const beginCreateEstimateVersion = () => {
    setRenamingVersionId(null);
    setNewVersionNameDraft(`Version ${estimateVersions.length + 1}`);
    setIsCreatingVersionDraft(true);
  };

  const cancelCreateEstimateVersion = () => {
    setNewVersionNameDraft("");
    setIsCreatingVersionDraft(false);
  };

  const confirmCreateEstimateVersion = async () => {
    const nextName = newVersionNameDraft.trim();
    if (!nextName) {
      toast.error("Version name is required");
      return;
    }

    const created = await createEstimateVersion(nextName);
    if (created) {
      setNewVersionNameDraft("");
      setIsCreatingVersionDraft(false);
    }
  };

  const saveVersionName = async (versionId: string) => {
    const nextName = (versionNameDrafts[versionId] || "").trim();
    if (!nextName) {
      toast.error("Version name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from("estimate_versions")
        .update({ name: nextName })
        .eq("id", versionId);

      if (error) throw error;

      setEstimateVersions((previous) =>
        previous.map((version) =>
          version.id === versionId ? { ...version, name: nextName } : version,
        ),
      );
      setRenamingVersionId(null);
      toast.success("Version renamed");
    } catch (error) {
      console.error("Failed to rename version:", error);
      toast.error("Failed to rename version");
    }
  };

  const deleteEstimateVersion = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from("estimate_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;

      setEstimateVersions((previous) => {
        const next = previous.filter((version) => version.id !== versionId);
        setSelectedVersionId((current) => {
          if (current !== versionId) return current;
          return next[next.length - 1]?.id || null;
        });
        return next;
      });

      setVersionNameDrafts((previous) => {
        const next = { ...previous };
        delete next[versionId];
        return next;
      });
      setRenamingVersionId((current) => (current === versionId ? null : current));
      toast.success("Version deleted");
    } catch (error) {
      console.error("Failed to delete version:", error);
      toast.error("Failed to delete version");
    }
  };

  const handleDownloadPDF = async () => {
    if (!estimate) return;

    const lineItemsForPdf = displayLineItems.map((item: any) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.total,
    }));
    const foldedPdfEstimate = foldProfitMarginIntoLineItems(
      lineItemsForPdf,
      Number(displaySubtotal) || 0,
      Number(displayProfitMargin) || 0,
    );

    await generateEstimatePDF({
      customerName: estimate.customer?.name || "Unknown Customer",
      jobName: estimate.job?.name || "",
      address: estimate.job?.address || "",
      companyName: estimate.account?.company_name || "",
      companyLogoUrl: estimate.account?.logo_url || "",
      companyEmail: estimate.account?.company_email || "",
      companyPhone: estimate.account?.company_phone || "",
      lineItems: foldedPdfEstimate.lineItems,
      subtotal: foldedPdfEstimate.subtotal,
      taxRate: displayTaxRate,
      tax: displayTax,
      discount: displayDiscount,
      total: displayTotal,
      notes: displayNotes || undefined,
      createdAt: activeVersionSnapshot?.created_at || estimate.created_at,
      expiresAt: estimate.expires_at,
      signatureImageUrl: (estimate as any).manual_approval_photo_url || undefined,
    });

    toast.success("PDF downloaded");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="" showBack backTo="/payments" />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-32">
        <PageHeader title="" showBack backTo="/payments" />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Estimate not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const hasChangeOrders = estimate.line_items.some((item: any) => item.is_change_order);
  const isRecurringQuote = !!estimate.recurring_job_id && !estimate.job_id;
  const jobStatusLabelMap: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    job: "Job",
    unscheduled: "Unscheduled",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    "in-progress": "In Progress",
    completed: "Completed",
    paid: "Paid",
  };
  const getJobStatusBadgeStatus = (status: string) => {
    switch (status) {
      case "unscheduled":
        return "unscheduled";
      case "unassigned":
      case "needs_invoice":
        return "attention";
      case "scheduled":
        return "scheduled";
      case "in_progress":
      case "in-progress":
        return "in_progress";
      case "completed":
      case "paid":
        return "completed";
      case "job":
        return "job";
      default:
        return "pending";
    }
  };
  const deriveJobStatus = () => {
    const directStatus =
      estimate.job?.display_status ||
      estimate.job?.status ||
      (estimate.recurring_job as any)?.display_status ||
      (estimate.recurring_job as any)?.status;

    if (directStatus !== "job") {
      return directStatus || "unscheduled";
    }

    // Raw "job" is ambiguous on lead records; infer a meaningful stage from schedules when available.
    const scheduleRows = ((estimate.job as any)?.job_schedules || []) as Array<{
      scheduled_date?: string | null;
      scheduled_time_start?: string | null;
      scheduled_time_end?: string | null;
    }>;
    const sortedSchedules = scheduleRows
      .filter((schedule) => Boolean(schedule?.scheduled_date))
      .sort((a, b) => {
        const dateCompare = (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
        if (dateCompare !== 0) return dateCompare;
        if (!a.scheduled_time_start) return 1;
        if (!b.scheduled_time_start) return -1;
        return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
      });

    const scheduledDate = estimate.job?.scheduled_date || sortedSchedules[0]?.scheduled_date;
    if (!scheduledDate) return "unscheduled";

    const scheduleStart = sortedSchedules[0]
      ? new Date(
          `${sortedSchedules[0].scheduled_date}T${sortedSchedules[0].scheduled_time_start || "00:00:00"}`,
        )
      : new Date(`${scheduledDate}T00:00:00`);
    const scheduleEnd = sortedSchedules[sortedSchedules.length - 1]
      ? new Date(
          `${sortedSchedules[sortedSchedules.length - 1].scheduled_date}T${sortedSchedules[sortedSchedules.length - 1].scheduled_time_end || "23:59:59"}`,
        )
      : new Date(`${scheduledDate}T23:59:59`);
    const now = new Date();

    if (now > scheduleEnd) return "completed";
    if (now >= scheduleStart && now <= scheduleEnd) return "in_progress";
    return "scheduled";
  };
  const rawJobStatus = deriveJobStatus();
  const jobStatusLabel = jobStatusLabelMap[rawJobStatus] || rawJobStatus;
  const displayTitle = isRecurringQuote
    ? `${estimate.customer?.name || "Unknown"} Quote`
    : `${estimate.customer?.name || "Unknown"}, Estimate`;
  const selectedVersion =
    estimateVersions.find((version) => version.id === selectedVersionId) || null;
  const canManageEstimateVersions =
    estimate.status !== "accepted" &&
    estimate.status !== "declined" &&
    !estimate.has_pending_changes;
  const hasEstimateVersions = estimateVersions.length > 0;
  const showNoVersionFullState =
    canManageEstimateVersions &&
    !loadingVersions &&
    !hasEstimateVersions;
  const canSelectVersionForApproval =
    estimate.status !== "accepted" &&
    estimate.status !== "declined" &&
    !estimate.has_pending_changes &&
    hasEstimateVersions;

  const hasOriginalEstimate = estimate.original_total != null && estimate.original_line_items;
  const showPendingChangesCard = estimate.has_pending_changes && !showingOriginal;
  const showApprovedCard =
    (estimate.status === "accepted" && !showPendingChangesCard) ||
    (estimate.has_pending_changes && showingOriginal);
  const activeVersionSnapshot =
    canManageEstimateVersions && !showingOriginal && selectedVersion ? selectedVersion : null;

  const displayLineItems = showingOriginal && hasOriginalEstimate
    ? estimate.original_line_items!
    : activeVersionSnapshot
      ? activeVersionSnapshot.line_items.map((item, index) => ({
          ...item,
          id: `version-item-${activeVersionSnapshot.id}-${index}`,
          is_change_order: false,
          change_order_approved: null,
          change_order_type: null,
        }))
      : estimate.line_items.filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted');

  const displayTotal = showingOriginal && hasOriginalEstimate
    ? estimate.original_total!
    : activeVersionSnapshot
      ? activeVersionSnapshot.total
      : estimate.total;
  const displaySubtotal = activeVersionSnapshot ? activeVersionSnapshot.subtotal : estimate.subtotal;
  const displayTaxRate = activeVersionSnapshot ? activeVersionSnapshot.tax_rate : estimate.tax_rate;
  const displayTax = activeVersionSnapshot ? activeVersionSnapshot.tax : estimate.tax;
  const displayDiscount = activeVersionSnapshot ? activeVersionSnapshot.discount : estimate.discount;
  const displayProfitMargin = activeVersionSnapshot
    ? Number(activeVersionSnapshot.profit_margin) || 0
    : Number(estimate.profit_margin) || 0;
  const displayNotes = activeVersionSnapshot ? activeVersionSnapshot.notes : estimate.notes;
  const editModalEstimate = activeVersionSnapshot
    ? {
        ...estimate,
        line_items: (activeVersionSnapshot.line_items || []).map((item, index) => ({
          id: `version-item-${activeVersionSnapshot.id}-${index}`,
          name: item.name,
          description: item.description || "",
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "each",
          unit_price: Number(item.unit_price) || 0,
          total: Number(item.total) || 0,
          sort_order: Number(item.sort_order ?? index),
          category: item.category || "other",
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
        })),
        subtotal: Number(activeVersionSnapshot.subtotal) || 0,
        tax_rate: Number(activeVersionSnapshot.tax_rate) || 0,
        tax: Number(activeVersionSnapshot.tax) || 0,
        discount: Number(activeVersionSnapshot.discount) || 0,
        total: Number(activeVersionSnapshot.total) || 0,
        profit_margin: Number(activeVersionSnapshot.profit_margin) || 0,
        surcharge: Number(activeVersionSnapshot.surcharge) || 0,
        notes: activeVersionSnapshot.notes || null,
      }
    : estimate;

  const groupedLineItems = [...displayLineItems]
    .sort((a, b) => {
      const categoryDiff =
        CATEGORY_ORDER.indexOf(normalizeCategory(a.category)) -
        CATEGORY_ORDER.indexOf(normalizeCategory(b.category));

      if (categoryDiff !== 0) return categoryDiff;

      return (a.sort_order || 0) - (b.sort_order || 0);
    })
    .reduce(
      (groups, item) => {
        const category = normalizeCategory(item.category);
        const existingGroup = groups.find((group) => group.category === category);

        if (existingGroup) {
          existingGroup.items.push(item);
        } else {
          groups.push({ category, items: [item] });
        }

        return groups;
      },
      [] as Array<{ category: (typeof CATEGORY_ORDER)[number]; items: typeof displayLineItems }>,
    );

  const resetManualApprovalPhoto = () => {
    if (manualApprovalPreviewUrl) {
      URL.revokeObjectURL(manualApprovalPreviewUrl);
    }

    setManualApprovalPhoto(null);
    setManualApprovalPreviewUrl(null);

    if (uploadPhotoInputRef.current) {
      uploadPhotoInputRef.current.value = "";
    }

    if (takePhotoInputRef.current) {
      takePhotoInputRef.current.value = "";
    }
  };

  const handleApproveDialogChange = (open: boolean) => {
    setShowApproveDialog(open);
    if (!open) {
      resetManualApprovalPhoto();
    }
  };

  const handleManualApprovalPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      event.target.value = "";
      return;
    }

    if (manualApprovalPreviewUrl) {
      URL.revokeObjectURL(manualApprovalPreviewUrl);
    }

    setManualApprovalPhoto(file);
    setManualApprovalPreviewUrl(URL.createObjectURL(file));
  };

  const uploadManualApprovalPhoto = async () => {
    if (!manualApprovalPhoto) return null;
    if (!id) {
      throw new Error("Missing estimate context");
    }

    const preparedFile = await prepareLeadPhotoForUpload(manualApprovalPhoto, 10 * 1024 * 1024);
    if (!preparedFile) {
      throw new Error("Image must be under 10MB");
    }

    const extension = preparedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `estimate-approvals/${id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("lead-photos")
      .upload(filePath, preparedFile, { contentType: preparedFile.type, upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("lead-photos")
      .getPublicUrl(filePath);

    return {
      filePath,
      publicUrl: urlData.publicUrl,
    };
  };

  const handleManualApprove = async () => {
    setManualApproving(true);
    const isApprovingPendingChanges = estimate.has_pending_changes === true;
    let uploadedPhoto: { filePath: string; publicUrl: string } | null = null;
    let photoUploadFailed = false;
    let photoPersistenceFailed = false;

    try {
      if (manualApprovalPhoto) {
        try {
          uploadedPhoto = await uploadManualApprovalPhoto();
        } catch (photoError) {
          photoUploadFailed = true;
          if (photoError instanceof Error && photoError.message === "Image must be under 10MB") {
            throw photoError;
          }

          console.error("Approval photo upload failed:", photoError);
        }
      }

      if (isApprovingPendingChanges) {
        const { error: changeOrderError } = await supabase
          .from("estimate_line_items")
          .update({ change_order_approved: true })
          .eq("estimate_id", id)
          .eq("is_change_order", true)
          .eq("change_order_approved", false);

        if (changeOrderError) throw changeOrderError;
      }

      if (!isApprovingPendingChanges && selectedVersion) {
        const { error: deleteItemsError } = await supabase
          .from("estimate_line_items")
          .delete()
          .eq("estimate_id", id);

        if (deleteItemsError) throw deleteItemsError;

        const versionLineItems = Array.isArray(selectedVersion.line_items)
          ? selectedVersion.line_items
          : [];

        if (versionLineItems.length > 0) {
          const { error: insertItemsError } = await supabase
            .from("estimate_line_items")
            .insert(
              versionLineItems.map((item, index) => ({
                estimate_id: id,
                account_id: estimate.account_id,
                name: item.name,
                description: item.description || null,
                quantity: Number(item.quantity) || 0,
                unit: item.unit || "item",
                unit_price: Number(item.unit_price) || 0,
                total: Number(item.total) || 0,
                sort_order: Number(item.sort_order ?? index),
                category: normalizeCategory(item.category),
                is_change_order: false,
                change_order_type: null,
                change_order_approved: null,
                changed_at: null,
                original_line_item_id: null,
              })),
            );

          if (insertItemsError) throw insertItemsError;
        }
      }

      const estimateApprovalUpdate: Record<string, unknown> = {
        approved_via: "manual",
        updated_at: new Date().toISOString(),
      };

      if (!isApprovingPendingChanges) {
        estimateApprovalUpdate.status = "accepted";
        if (selectedVersion) {
          estimateApprovalUpdate.subtotal = Number(selectedVersion.subtotal) || 0;
          estimateApprovalUpdate.tax_rate = Number(selectedVersion.tax_rate) || 0;
          estimateApprovalUpdate.tax = Number(selectedVersion.tax) || 0;
          estimateApprovalUpdate.discount = Number(selectedVersion.discount) || 0;
          estimateApprovalUpdate.total = Number(selectedVersion.total) || 0;
          estimateApprovalUpdate.profit_margin = Number(selectedVersion.profit_margin) || 0;
          estimateApprovalUpdate.surcharge = Number(selectedVersion.surcharge) || 0;
          estimateApprovalUpdate.notes = selectedVersion.notes || null;
        }
      }

      estimateApprovalUpdate.accepted_at = new Date().toISOString();

      if (uploadedPhoto?.publicUrl) {
        estimateApprovalUpdate.manual_approval_photo_url = uploadedPhoto.publicUrl;
      } else if (!isApprovingPendingChanges) {
        estimateApprovalUpdate.manual_approval_photo_url = null;
      }

      const estimateUpdateQuery = supabase
        .from("estimates")
        .update(estimateApprovalUpdate)
        .eq("id", id);
      const { error } = await estimateUpdateQuery;

      if (
        error &&
        uploadedPhoto?.publicUrl &&
        "manual_approval_photo_url" in estimateApprovalUpdate &&
        isManualApprovalPhotoColumnMissing(error)
      ) {
        const { manual_approval_photo_url: _manualApprovalPhotoUrl, ...estimateApprovalFallbackUpdate } =
          estimateApprovalUpdate;

        const { error: fallbackError } = await supabase
          .from("estimates")
          .update(estimateApprovalFallbackUpdate)
          .eq("id", id);

        if (fallbackError) throw fallbackError;

        photoPersistenceFailed = true;
      } else if (error) {
        throw error;
      }

      if (!isApprovingPendingChanges) {
        let deleteVersionsQuery = supabase
          .from("estimate_versions")
          .delete()
          .eq("estimate_id", id);

        if (selectedVersion?.id) {
          deleteVersionsQuery = deleteVersionsQuery.neq("id", selectedVersion.id);
        }

        const { error: deleteVersionsError } = await deleteVersionsQuery;
        if (deleteVersionsError) {
          console.error("Failed to remove unused estimate versions after manual approval:", deleteVersionsError);
        }
      }

      if (photoPersistenceFailed && uploadedPhoto?.filePath) {
        const { error: removePhotoError } = await supabase.storage.from("lead-photos").remove([uploadedPhoto.filePath]);
        if (removePhotoError) {
          console.error("Failed to remove unlinked manual approval photo:", removePhotoError);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["estimate", id] });
      await queryClient.invalidateQueries({ queryKey: ["estimates"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await fetchEstimateVersions();
      setShowApproveDialog(false);
      resetManualApprovalPhoto();
      const approvalSubject = isApprovingPendingChanges ? "Changes" : "Estimate";
      toast.success(
        photoUploadFailed || photoPersistenceFailed
          ? `${approvalSubject} approved without saving the signature photo`
          : manualApprovalPhoto
            ? `${approvalSubject} approved and signature saved`
            : `${approvalSubject} marked as approved`,
      );
    } catch (error) {
      if (uploadedPhoto?.filePath) {
        await supabase.storage.from("lead-photos").remove([uploadedPhoto.filePath]);
      }

      toast.error(isApprovingPendingChanges ? "Failed to approve changes" : "Failed to approve estimate");
    } finally {
      setManualApproving(false);
    }
  };

  const handleEstimateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["estimate", id] });
    await queryClient.invalidateQueries({ queryKey: ["estimates"] });
    await fetchEstimateVersions();
  };

  const resolveCustomerPortalLink = async () => {
    const customerId = estimate?.customer?.id;
    if (!customerId) {
      throw new Error("No customer associated with this estimate");
    }

    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("client_portal_token, phone, email")
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

    return {
      link: buildClientPortalShareUrl(token, {
        customDomain: currentAccount?.settings?.website?.custom_domain ?? null,
      }),
      phone: customer?.phone?.trim() || "",
      email: customer?.email?.trim() || "",
    };
  };

  const handleOpenClientPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const portalData = await resolveCustomerPortalLink();
      setPortalLink(portalData.link);
      setPortalClientPhone(portalData.phone);
      setPortalClientEmail(portalData.email);
      setPortalDialogOpen(true);
    } catch {
      toast.error("Failed to generate portal link");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyPortalLink = async () => {
    if (!portalLink) return;
    try {
      await navigator.clipboard.writeText(portalLink);
      setPortalCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setPortalCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleQuickEstimateSave = async (breakdown: QuickEstimateBreakdown) => {
    const { serviceType, measurements, result } = breakdown;
    const label = SERVICE_LABELS[serviceType];
    const qty = serviceType === "fencing"
      ? (measurements.linearFeet || 0)
      : (measurements.sqft || 0);
    const unit = serviceType === "fencing" ? "linear ft" : "sq ft";
    const overheadAmount = result.totalMid - result.laborTotal - result.materialTotal;

    const newItems = [
      { name: `${label} - Labor`, description: null as string | null, quantity: qty, unit, unit_price: qty > 0 ? parseFloat((result.laborTotal / qty).toFixed(2)) : 0 },
      { name: `${label} - Materials`, description: "Includes waste factor", quantity: qty, unit, unit_price: qty > 0 ? parseFloat((result.materialTotal / qty).toFixed(2)) : 0 },
      { name: "Overhead & Profit", description: null as string | null, quantity: 1, unit: "item", unit_price: parseFloat(overheadAmount.toFixed(2)) },
    ];

    try {
      const existingItems = estimate.line_items.filter(
        (item: any) => !item.is_change_order || item.change_order_type !== 'deleted'
      );
      for (const item of existingItems) {
        await supabase.from('estimate_line_items').delete().eq('id', item.id);
      }

      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const total = item.quantity * item.unit_price;
        const { error } = await supabase.from('estimate_line_items').insert({
          estimate_id: id,
          account_id: estimate.account_id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total,
          sort_order: i,
          is_change_order: false,
        });
        if (error) throw error;
      }

      const newSubtotal = newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const profitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
      const profitAmount = newSubtotal * (profitMargin / 100);
      const subtotalWithProfit = newSubtotal + profitAmount;
      const newTax = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
      const newTotal = subtotalWithProfit + newTax - parseFloat(estimate.discount.toString());

      await supabase
        .from('estimates')
        .update({ subtotal: newSubtotal, tax: newTax, total: newTotal, updated_at: new Date().toISOString() })
        .eq('id', id);

      await queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      await queryClient.invalidateQueries({ queryKey: ['estimates'] });

      setShowQuickEstimate(false);
      toast.success('Estimate updated from quick estimate');
    } catch (error) {
      console.error('Error saving quick estimate:', error);
      toast.error('Failed to save quick estimate');
    }
  };

  const enterEditMode = () => {
    const activeItems = estimate.line_items.filter(
      (item: any) => !item.is_change_order || item.change_order_type !== 'deleted'
    );

    setLineItems(
      activeItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        quantity: item.quantity.toString(),
        unit: item.unit,
        unit_price: item.unit_price.toString(),
      }))
    );
    setEditMode(true);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        name: '',
        description: '',
        quantity: '1',
        unit: 'item',
        unit_price: '',
        isNew: true,
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    const item = lineItems[index];
    if (item.id) {
      item.originalId = item.id;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      const shouldTrackChanges = estimate.status === 'accepted';

      const existingIds = new Set(
        estimate.line_items
          .filter((item: any) => !item.is_change_order || item.change_order_type !== 'deleted')
          .map((item: any) => item.id)
      );

      const currentIds = new Set(lineItems.filter((item) => item.id).map((item) => item.id));
      const deletedIds = Array.from(existingIds).filter((id) => !currentIds.has(id as string));

      // Handle deleted items
      if (shouldTrackChanges) {
        // Track as change order
        for (const deletedId of deletedIds) {
          const { error } = await supabase
            .from('estimate_line_items')
            .update({
              is_change_order: true,
              change_order_type: 'deleted',
              changed_at: new Date().toISOString(),
              change_order_approved: false,
            })
            .eq('id', deletedId);

          if (error) throw error;
        }
      } else {
        // Just delete the items
        for (const deletedId of deletedIds) {
          const { error } = await supabase
            .from('estimate_line_items')
            .delete()
            .eq('id', deletedId);

          if (error) throw error;
        }
      }

      for (const item of lineItems) {
        const quantity = parseFloat(item.quantity) || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const total = quantity * unitPrice;

        if (item.isNew) {
          if (shouldTrackChanges) {
            // Add as change order
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              is_change_order: true,
              change_order_type: 'added',
              changed_at: new Date().toISOString(),
              change_order_approved: false,
            });

            if (error) throw error;
          } else {
            // Add as normal item
            const { error } = await supabase.from('estimate_line_items').insert({
              estimate_id: id,
              account_id: estimate.account_id,
              name: item.name,
              description: item.description || null,
              quantity,
              unit: item.unit,
              unit_price: unitPrice,
              total,
              sort_order: lineItems.indexOf(item),
              is_change_order: false,
            });

            if (error) throw error;
          }
        } else if (item.id) {
          const original = estimate.line_items.find((li: any) => li.id === item.id);

          const normalizeValue = (val: any) => (val === null || val === undefined || val === '') ? null : val;

          const hasChanged =
            original &&
            (original.name !== item.name ||
              normalizeValue(original.description) !== normalizeValue(item.description) ||
              parseFloat(original.quantity) !== quantity ||
              original.unit !== item.unit ||
              parseFloat(original.unit_price) !== unitPrice);

          if (hasChanged) {
            if (shouldTrackChanges) {
              // Track as change order
              await supabase
                .from('estimate_line_items')
                .update({
                  is_change_order: true,
                  change_order_type: 'deleted',
                  changed_at: new Date().toISOString(),
                  change_order_approved: false,
                })
                .eq('id', item.id);

              const { error } = await supabase.from('estimate_line_items').insert({
                estimate_id: id,
                account_id: estimate.account_id,
                name: item.name,
                description: item.description || null,
                quantity,
                unit: item.unit,
                unit_price: unitPrice,
                total,
                sort_order: lineItems.indexOf(item),
                is_change_order: true,
                change_order_type: 'edited',
                original_line_item_id: item.id,
                changed_at: new Date().toISOString(),
                change_order_approved: false,
              });

              if (error) throw error;
            } else {
              // Just update the item
              const { error } = await supabase
                .from('estimate_line_items')
                .update({
                  name: item.name,
                  description: item.description || null,
                  quantity,
                  unit: item.unit,
                  unit_price: unitPrice,
                  total,
                  sort_order: lineItems.indexOf(item),
                })
                .eq('id', item.id);

              if (error) throw error;
            }
          }
        }
      }

      const activeItems = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', id)
        .or('is_change_order.is.null,and(is_change_order.eq.false),and(is_change_order.eq.true,change_order_type.neq.deleted)');

      if (activeItems.data) {
        const newSubtotal = activeItems.data.reduce(
          (sum, item) => sum + parseFloat(item.total.toString()),
          0
        );
        const profitMargin = parseFloat(estimate.profit_margin?.toString() || '0');
        const profitAmount = newSubtotal * (profitMargin / 100);
        const subtotalWithProfit = newSubtotal + profitAmount;
        const newTax = subtotalWithProfit * parseFloat(estimate.tax_rate.toString());
        const newTotal = subtotalWithProfit + newTax - parseFloat(estimate.discount.toString());

        await supabase
          .from('estimates')
          .update({
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      await queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      await queryClient.invalidateQueries({ queryKey: ['estimates'] });

      if (shouldTrackChanges) {
        toast.success('Changes saved and tracked as change orders');
      } else {
        toast.success('Changes saved successfully');
      }
      setEditMode(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setLineItems([]);
  };

  const approveDisabled = (estimate.status === "accepted" && !estimate.has_pending_changes) || manualApproving;
  const approveLabel = approveDisabled
    ? manualApproving
      ? "Approving..."
      : "Approved"
    : "Approve";
  const canLogPayments = typeof isManager === "function" ? isManager() : false;
  const portalLabel = portalLoading ? "Generating..." : "Client Portal";
  const mobileQuickActions = [
    {
      icon: <Check className="h-5 w-5" />,
      label: approveLabel,
      disabled: approveDisabled,
      onClick: () => {
        if (!approveDisabled) setShowApproveDialog(true);
      },
      group: "estimate-actions",
    },
    {
      icon: <Link2 className="h-5 w-5" />,
      label: portalLabel,
      onClick: () => {
        if (!portalLoading) void handleOpenClientPortal();
      },
      group: "estimate-actions",
    },
    ...(estimate.customer?.id
      ? [{
          icon: <User className="h-5 w-5" />,
          label: "View Contact",
          onClick: () => navigate(`/customers/${estimate.customer?.id}`),
          group: "details",
        }]
      : []),
    ...(estimate.job?.id
      ? [{
          icon: <Briefcase className="h-5 w-5" />,
          label: "View Job",
          onClick: () => navigate(`/jobs/${estimate.job?.id}`),
          group: "details",
        }]
      : []),
    ...(canLogPayments && estimate.job_id
      ? [{
          icon: <DollarSign className="h-5 w-5" />,
          label: "Log Payment",
          onClick: () => setOpenLogPaymentSignal((value) => value + 1),
          group: "estimate-actions",
        }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24 [&_.text-xs]:text-base [&_.text-sm]:text-base md:[&_.text-xs]:text-xs md:[&_.text-sm]:text-sm">
      <PageHeader title="" showBack backTo="/payments" />


      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 md:pt-8 pb-0">
        <div className="mb-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {estimate.has_pending_changes && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                <AlertCircle className="h-3 w-3 text-amber-700" />
                Changes Pending Approval
              </span>
            )}
          </div>
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
            data-testid="estimate-header-summary-row"
          >
            <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">
              {isRecurringQuote ? "Quote" : "Estimate"}
            </h2>
            <p className="text-muted-foreground">
              {isRecurringQuote
                ? (estimate.recurring_job?.name || "Job Schedule")
                : (estimate.job?.name || "Unknown Job")}
            </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
              ${Number(displayTotal).toLocaleString()}
              </p>
              {estimate.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Expires {format(new Date(estimate.expires_at), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>
          {!isMobile && (
            <div
              className="flex flex-nowrap items-center justify-start gap-2"
              data-testid="estimate-header-quick-actions"
            >
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => setShowApproveDialog(true)}
                disabled={(estimate.status === "accepted" && !estimate.has_pending_changes) || manualApproving}
              >
                <Check className="h-4 w-4" />
                {(estimate.status === "accepted" && !estimate.has_pending_changes)
                  ? "Approved"
                  : manualApproving
                    ? "Approving..."
                    : "Approve"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={handleOpenClientPortal}
                disabled={portalLoading}
              >
                <Link2 className="h-4 w-4" />
                {portalLoading ? "Generating..." : "Client Portal"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 max-w-[var(--content-max-width)] m-auto">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div className="space-y-4" data-testid="estimate-details-left-column">
            <div className="card-elevated -mx-4 overflow-hidden rounded-none md:mx-0 md:rounded-lg">
              <div className={cn("p-4", isMobile && "pt-0")}>
                {canManageEstimateVersions && (
                  <div className={cn("space-y-3", isMobile ? "mb-2 space-y-2" : "mb-4")}>
                    {loadingVersions ? (
                      <p className="text-sm text-muted-foreground">Loading versions...</p>
                    ) : hasEstimateVersions ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0">
                          <Tabs
                            value={selectedVersionId || estimateVersions[0]?.id}
                            onValueChange={(value) => {
                              setSelectedVersionId(value);
                              setRenamingVersionId(null);
                            }}
                            className="mt-0 min-w-0 max-w-full"
                          >
                            <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden">
                              <TabsList className="inline-flex w-max justify-start rounded-none bg-transparent p-0">
                                {estimateVersions.map((version) => (
                                  <TabsTrigger
                                    key={version.id}
                                    value={version.id}
                                    className={cn(
                                      "h-auto shrink-0 rounded-none border-b-2 border-transparent font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                                      isMobile
                                        ? "min-h-touch px-2 py-3 text-center text-base transition-colors whitespace-nowrap"
                                        : "min-h-[56px] px-4 py-2 text-left"
                                    )}
                                  >
                                    <span className={cn("flex min-w-0 flex-col leading-tight", isMobile ? "items-center text-center" : "items-start")}>
                                      <span className="truncate text-sm font-medium">{version.name}</span>
                                      <span className="mt-1 text-[11px] font-normal text-muted-foreground/70">
                                        ${Number(version.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </span>
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                            </div>
                          </Tabs>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 shrink-0 p-0"
                                aria-label="Version actions"
                              >
                                <EllipsisVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void handleDownloadPDF()}>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  beginCreateEstimateVersion();
                                }}
                                disabled={creatingVersion || isCreatingVersionDraft}
                              >
                                Add
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!selectedVersion) return;
                                  setIsCreatingVersionDraft(false);
                                  setRenamingVersionId(selectedVersion.id);
                                }}
                                disabled={!selectedVersion}
                              >
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!selectedVersion) return;
                                  const confirmed = window.confirm(`Delete "${selectedVersion.name}"?`);
                                  if (!confirmed) return;
                                  void deleteEstimateVersion(selectedVersion.id);
                                }}
                                disabled={!selectedVersion}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {isCreatingVersionDraft ? (
                          <div className="pb-1 space-y-2">
                                <input
                                  value={newVersionNameDraft}
                                  onChange={(event) => setNewVersionNameDraft(event.target.value)}
                              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                              placeholder="Version name"
                            />
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelCreateEstimateVersion}
                                aria-label="Cancel version creation"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={confirmCreateEstimateVersion}
                                disabled={creatingVersion}
                                aria-label="Confirm version creation"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : selectedVersion ? (
                          <div className="pb-1">
                            {renamingVersionId === selectedVersion.id ? (
                              <div className="space-y-2">
                                <input
                                  value={versionNameDrafts[selectedVersion.id] || ""}
                                  onChange={(event) =>
                                    setVersionNameDrafts((previous) => ({
                                      ...previous,
                                      [selectedVersion.id]: event.target.value,
                                    }))
                                  }
                                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                                />
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => saveVersionName(selectedVersion.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setVersionNameDrafts((previous) => ({
                                        ...previous,
                                        [selectedVersion.id]: selectedVersion.name,
                                      }));
                                      setRenamingVersionId(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="h-1" />
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                {hasOriginalEstimate && (
                  <>
                    <div className={cn("flex gap-2", isMobile ? "items-center" : "items-end")}>
                      <Tabs
                        value={showingOriginal ? "original" : "modified"}
                        onValueChange={(value) => setShowingOriginal(value === "original")}
                        className="mt-0 flex-1"
                      >
                        <TabsList
                          className={cn(
                            "rounded-none bg-transparent p-0",
                            isMobile ? "grid w-full grid-cols-2 px-2" : "w-full justify-start"
                          )}
                        >
                          <TabsTrigger
                            value="modified"
                            className={cn(
                              "rounded-none border-b-2 border-transparent font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                              isMobile
                                ? "w-full min-h-touch px-2 py-3 text-center text-base transition-colors whitespace-nowrap"
                                : "px-4 py-3 text-sm"
                            )}
                          >
                            Current
                          </TabsTrigger>
                          <TabsTrigger
                            value="original"
                            className={cn(
                              "rounded-none border-b-2 border-transparent font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                              isMobile
                                ? "w-full min-h-touch px-2 py-3 text-center text-base transition-colors whitespace-nowrap"
                                : "px-4 py-3 text-sm"
                            )}
                          >
                            Original
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 shrink-0 p-0"
                            aria-label="Compare version actions"
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void handleDownloadPDF()}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                )}
                {showPendingChangesCard && (
                  <div className="mt-3">
                    <div data-testid="pending-changes-alert" className="rounded-md bg-amber-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-900">
                          This estimate has pending changes awaiting customer approval.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {showApprovedCard && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                    <button
                      type="button"
                      className="mb-1 flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => setShowApprovedDetails((current) => !current)}
                      aria-expanded={showApprovedDetails}
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <h4 className="font-semibold text-emerald-700">Approved</h4>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-emerald-700 transition-transform",
                          showApprovedDetails ? "rotate-90" : "",
                        )}
                      />
                    </button>
                    {showApprovedDetails && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {(estimate as any).approved_via === "customer_link"
                            ? "Approved by customer via approval link"
                            : (estimate as any).approved_via === "manual"
                              ? "Manually marked as approved"
                              : "This estimate has been approved"}
                          {estimate.accepted_at && (
                            <> on {format(new Date(estimate.accepted_at), "MMM d, yyyy 'at' h:mm a")}</>
                          )}
                        </p>
                        {(estimate as any).manual_approval_photo_url && (
                          <div className="mt-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Signature photo
                            </p>
                            <img
                              src={(estimate as any).manual_approval_photo_url}
                              alt="Signature photo captured during approval"
                              className="mt-2 max-h-40 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 object-contain shadow-sm"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {showNoVersionFullState ? (
                  <div className="mt-3 flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                    <h4 className="text-lg font-semibold text-foreground">No estimate versions yet</h4>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Create your first version to build and present pricing options.
                    </p>
                    <Button
                      className="mt-5 gap-2"
                      onClick={() => {
                        void createEstimateVersion();
                      }}
                      disabled={creatingVersion}
                    >
                      <Plus className="h-4 w-4" />
                      {creatingVersion ? "Creating..." : "Create Version"}
                    </Button>
                  </div>
                ) : (
                  <div data-testid="line-items-header-row" className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-2">
                      <FileText className="h-5 w-5 md:h-3.5 md:w-3.5 shrink-0 text-muted-foreground" />
                      <h4 className="text-base uppercase tracking-wide leading-none text-muted-foreground">Line Items</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {!showNoVersionFullState && (
                <>
                  {groupedLineItems.length > 0 ? (
                    groupedLineItems.map((group, groupIndex) => (
                      <div key={group.category}>
                        <div
                          className="px-4 py-2 text-muted-foreground"
                        >
                          <p
                            className="text-xs uppercase tracking-wide"
                            data-testid="line-item-category-heading"
                          >
                            {CATEGORY_LABELS[group.category]}
                          </p>
                        </div>
                        {group.items.map((item, itemIndex) => (
                          <div
                            key={item.id || `${group.category}-${itemIndex}-${item.name}`}
                            className="px-4 py-2"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="font-medium text-foreground">{item.name}</p>
                                  {item.is_change_order && item.change_order_approved === false && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border-amber-200"
                                    >
                                      Pending Approval
                                    </Badge>
                                  )}
                                  {item.is_change_order && item.change_order_approved === true && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border-emerald-200"
                                    >
                                      <CheckCheck className="h-3 w-3 mr-1" />
                                      Approved
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (() => {
                                  const descriptionId = item.id || `line-item-${groupIndex}-${itemIndex}`;
                                  const hasLongDescription = item.description.trim().length > 180;
                                  const isDescriptionExpanded = expandedDescriptions.has(descriptionId);
                                  const toggleDescription = () => {
                                    setExpandedDescriptions((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(descriptionId)) {
                                        next.delete(descriptionId);
                                      } else {
                                        next.add(descriptionId);
                                      }
                                      return next;
                                    });
                                  };

                                  return (
                                    <div className="mt-0.5">
                                      <p
                                        className={`text-sm text-muted-foreground break-words ${
                                          isDescriptionExpanded ? "" : "line-clamp-3"
                                        }`}
                                      >
                                        {item.description}
                                      </p>
                                      {hasLongDescription && (
                                        <button
                                          type="button"
                                          className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                                          onClick={toggleDescription}
                                        >
                                          {isDescriptionExpanded ? "View less" : "View more"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="ml-4 text-right">
                                <p className="font-semibold text-foreground">
                                  ${Number(item.total).toLocaleString()}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.quantity} {item.unit} × ${Number(item.unit_price).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      No line items found
                    </div>
                  )}

                  <div className="mx-4 my-4 rounded-lg bg-secondary p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">${Number(displaySubtotal).toLocaleString()}</span>
                    </div>
                    {displayProfitMargin > 0 && (
                      <div className="flex justify-between gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Profit ({displayProfitMargin.toFixed(0)}%)</span>
                          <p className="mt-0.5 text-xs text-muted-foreground">(Hidden from customer)</p>
                        </div>
                        <span className="text-foreground">${(Number(displaySubtotal) * (displayProfitMargin / 100)).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({(Number(displayTaxRate) * 100).toFixed(0)}%)</span>
                      <span className="text-foreground">${Number(displayTax).toLocaleString()}</span>
                    </div>
                    {Number(displayDiscount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-[hsl(var(--status-confirmed))]">-${Number(displayDiscount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-bold text-lg text-foreground">${Number(displayTotal).toLocaleString()}</span>
                    </div>
                  </div>

                  {displayNotes && (
                    <div className="p-4 border-t border-border">
                      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Notes</h3>
                      <p className="text-sm text-muted-foreground mt-2">{displayNotes}</p>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          <div className="space-y-4" data-testid="estimate-details-right-column">
            <button
              className="hidden w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))] md:block"
              onClick={() => estimate.customer && navigate(`/customers/${estimate.customer.id}`)}
            >
              <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                <div className="flex gap-2 items-center">
                  <User className="w-3 h-3" />
                  <p className="text-xs uppercase tracking-wide">Contact</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  View
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-semibold leading-tight text-foreground">
                  {estimate.customer?.name || "Unknown"}
                </p>
              </div>
            </button>

            {isRecurringQuote ? (
              <div className="hidden w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm md:block">
                <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                <div className="flex gap-2 items-center">
                    <Briefcase className="w-3 h-3" />
                  </div>
                  <StatusBadge status={getJobStatusBadgeStatus(rawJobStatus) as any}>
                    {jobStatusLabel}
                  </StatusBadge>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-semibold leading-tight text-foreground">
                    {estimate.recurring_job?.service_type || estimate.job?.service_type || (estimate as any).service_type || "No service type"}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs text-pretty">
                    {estimate.recurring_job?.name || "Unknown"}
                  </p>
                </div>
                <div className="mt-6">
                  <div className="w-full rounded-full bg-muted px-5 py-3 text-center font-semibold whitespace-nowrap text-foreground text-sm">
                    View Details
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="hidden w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))] md:block"
                onClick={() => estimate.job && navigate(`/jobs/${estimate.job.id}`)}
              >
                <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
                  <div className="flex gap-2 items-center">
                    <Briefcase className="w-3 h-3" />
                  </div>
                  <StatusBadge status={getJobStatusBadgeStatus(rawJobStatus) as any}>
                    {jobStatusLabel}
                  </StatusBadge>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-semibold leading-tight text-foreground">
                    {estimate.job?.service_type || (estimate as any).service_type || "No service type"}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs text-pretty">
                    {estimate.job?.name || "Unknown"}
                  </p>
                </div>
                <div className="mt-6">
                  <div className="w-full rounded-full bg-muted px-5 py-3 text-center font-semibold whitespace-nowrap text-foreground text-sm">
                    View Job
                  </div>
                </div>
              </button>
            )}

            {estimate.job_id ? (
              <div className="hidden md:block">
                <JobInvoiceCard
                  jobId={estimate.job_id}
                  customerEmail={estimate.customer?.email}
                  customerName={estimate.customer?.name}
                  estimateTotal={Number(estimate.total)}
                  openLogPaymentSignal={openLogPaymentSignal}
                />
              </div>
            ) : (
              <div className="hidden card-elevated rounded-lg p-4 md:block">
                <h3 className="font-semibold text-foreground">Invoices</h3>
                <p className="text-sm text-muted-foreground mt-3">
                  Invoices are available on job-based estimates.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showApproveDialog} onOpenChange={handleApproveDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {estimate.has_pending_changes
                ? "Approve Changes"
                : isRecurringQuote
                  ? "Approve Quote"
                  : "Approve Estimate"}
            </DialogTitle>
            <DialogDescription>
              {estimate.has_pending_changes
                ? "This approves the pending change order updates. Add a photo only if you want it attached to this approval."
                : isRecurringQuote
                ? "This marks the quote as approved. Add a photo only if you want it attached to the approval."
                : "This marks the estimate as approved. Add a photo only if you want it attached to the approval."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {canSelectVersionForApproval && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Version to approve</p>
                <select
                  value={selectedVersionId || ""}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {estimateVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name} - ${Number(version.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Signature photo</p>
              <p className="text-sm text-muted-foreground">
                Optional. You can approve now and add the photo later if needed.
              </p>
            </div>

            {manualApprovalPreviewUrl ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <img
                    src={manualApprovalPreviewUrl}
                    alt="Selected signature photo"
                    className="max-h-48 w-full bg-muted/20 object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm text-muted-foreground">
                    {manualApprovalPhoto?.name}
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={resetManualApprovalPhoto}>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => takePhotoInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => uploadPhotoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </div>
            )}
          </div>

          <input
            ref={takePhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleManualApprovalPhotoSelect}
            className="hidden"
          />
          <input
            ref={uploadPhotoInputRef}
            data-testid="manual-approval-upload-input"
            type="file"
            accept="image/*"
            onChange={handleManualApprovalPhotoSelect}
            className="hidden"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => handleApproveDialogChange(false)} disabled={manualApproving}>
              Cancel
            </Button>
            <Button
              onClick={handleManualApprove}
              disabled={manualApproving || (canSelectVersionForApproval && !selectedVersionId)}
            >
              {manualApproving
                ? "Approving..."
                : estimate.has_pending_changes
                  ? "Approve Changes"
                  : isRecurringQuote
                    ? "Approve Quote"
                    : "Approve Estimate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientPortalLinkDialog
        open={portalDialogOpen}
        onOpenChange={setPortalDialogOpen}
        portalLink={portalLink || ""}
        copied={portalCopied}
        onCopy={handleCopyPortalLink}
        clientPhone={portalClientPhone || estimate.customer?.phone || ""}
        clientEmail={portalClientEmail || estimate.customer?.email || ""}
        allowTextClient={currentAccount?.pricing_plan !== "free"}
        allowEmailClient={currentAccount?.pricing_plan !== "free"}
      />

      <EditEstimateModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        estimate={editModalEstimate}
        versionId={activeVersionSnapshot?.id || null}
        versionName={activeVersionSnapshot?.name || null}
        onSuccess={handleEstimateSuccess}
      />

      {isMobile && (
        <FloatingActionButton
          actions={mobileQuickActions}
          className="md:hidden"
          triggerIcon="wrench"
        />
      )}

      <MobileNav />
    </div>
  );
}
