import { useState, useEffect } from "react";
import {
  RotateCcw,
  Loader as Loader2,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Upload,
  Package,
  Calculator,
  Percent,
  HandCoins,
  CircleDollarSign,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  DEFAULT_PRICING_RULES,
  SERVICE_LABELS,
  ServiceType,
} from "@/hooks/useQuickEstimate";
import {
  createLineItemTemplate,
  deleteLineItemTemplate,
  getLineItemTemplates,
  migrateLegacyTemplatesToDatabase,
  updateLineItemTemplate,
  type LineItemBundleItem,
  type LineItemTemplate,
} from "@/lib/lineItemTemplates";
import { LineItemTemplateCSVImportModal } from "@/components/settings/LineItemTemplateCSVImportModal";
import { LineItemTemplateSearch } from "@/components/templates/LineItemTemplateSearch";
import { LINE_ITEM_UNIT_OPTIONS } from "@/constants/lineItemUnits";
import { UnitSelect } from "@/components/shared/UnitSelect";

interface PricingRule {
  id?: string;
  user_id: string;
  account_id?: string;
  service_type: string;
  base_labor_rate: number;
  material_rate: number;
  waste_factor: number;
  overhead_multiplier: number;
  profit_margin: number;
  unit_type: string;
  notes?: string;
}

interface ServiceTypeDraft {
  name: string;
  unit_type: string;
  price_per_unit: string;
  min_job_size: string;
  description: string;
}

interface BundleDraftItem {
  template_id: string;
  quantity_per_unit: string;
}

interface BundleDraft {
  name: string;
  description: string;
  unit: string;
  items: BundleDraftItem[];
}

const slugifyServiceType = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "service_type";
};

const titleCaseServiceType = (serviceType: string) => {
  return serviceType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getUnitTypeLabel = (unitType: string) => {
  if (unitType === "sq_ft") return "sq ft";
  if (unitType === "linear_ft") return "linear ft";

  const matched = LINE_ITEM_UNIT_OPTIONS.find((option) => option.value === unitType);
  if (matched) return matched.label.toLowerCase();

  return unitType.replace(/_/g, " ");
};

const normalizeServiceTypeUnitForDisplay = (unitType: string | undefined) => {
  const value = String(unitType || "").trim().toLowerCase();
  if (!value) return "sq ft";
  if (value === "sq_ft" || value === "sq ft" || value === "square feet") return "sq ft";
  if (value === "linear_ft" || value === "linear ft") return "linear ft";
  if (value === "cubic_yd" || value === "cubic yd") return "cubic yd";
  if (value === "cubic_ft" || value === "cubic ft") return "cubic ft";
  return getUnitTypeLabel(value);
};

const getServiceTypeNotesForDisplay = (notes: string | undefined, unitType: string) => {
  if (!notes) return "";

  const normalizedUnit = normalizeServiceTypeUnitForDisplay(unitType);
  return notes.replace(
    /^\s*per\s+(sq\s*ft|square\s*feet|linear\s*ft|cubic\s*yd|cubic\s*ft|yard|yards)\b\s*/i,
    `Per ${normalizedUnit} `,
  );
};

const UNIT_SELECT_OPTIONS = [
  { value: "bundle", label: "Bundle" },
  ...LINE_ITEM_UNIT_OPTIONS,
] as const;

const SERVICE_TYPE_UNIT_OPTIONS = [
  { value: "sq_ft", label: "Square Feet" },
  { value: "linear_ft", label: "Linear Feet" },
  ...LINE_ITEM_UNIT_OPTIONS,
];

export default function SettingsPricingRules() {
  const { user, currentAccount, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);
  const defaultServiceTypes = Object.keys(DEFAULT_PRICING_RULES) as ServiceType[];
  const [rules, setRules] = useState<Record<string, PricingRule>>({});
  const [serviceTypeOrder, setServiceTypeOrder] = useState<string[]>([]);
  const [serviceTypeMinimums, setServiceTypeMinimums] = useState<Record<string, number>>({});
  const [editingServiceType, setEditingServiceType] = useState<string | null>(null);
  const [showServiceTypeForm, setShowServiceTypeForm] = useState(false);
  const [serviceTypeDraft, setServiceTypeDraft] = useState<ServiceTypeDraft>({
    name: "",
    unit_type: "sq_ft",
    price_per_unit: "0",
    min_job_size: "0",
    description: "",
  });
  const [taxRate, setTaxRate] = useState<string>("");
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [surcharge, setSurcharge] = useState<string>("");
  const [depositPercentage, setDepositPercentage] = useState<string>("33");
  const [midpointPercentage, setMidpointPercentage] = useState<string>("33");
  const [finalPercentage, setFinalPercentage] = useState<string>("34");
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const [showTemplateImportModal, setShowTemplateImportModal] = useState(false);
  const [showTemplateTypeDialog, setShowTemplateTypeDialog] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    description: "",
    quantity: "1",
    unit: "each",
    unit_price: "0",
    category: "other",
  });
  const [bundleDraft, setBundleDraft] = useState<BundleDraft>({
    name: "",
    description: "",
    unit: "bundle",
    items: [],
  });
  const [bundleTemplateQuery, setBundleTemplateQuery] = useState("");

  useEffect(() => {
    void fetchRules();
  }, [user?.id, currentAccount?.id]);

  useEffect(() => {
    if (currentAccount) {
      setTaxRate(String(currentAccount.default_tax_rate ?? 8));
      setProfitMargin(String(currentAccount.default_profit_margin ?? 0));
      setSurcharge(String(currentAccount.default_surcharge ?? 0));
      const settings = (currentAccount.settings as Record<string, unknown> | null) ?? {};
      const paymentDefaultsRaw = settings.default_payment_schedule;
      const paymentDefaults =
        paymentDefaultsRaw && typeof paymentDefaultsRaw === "object" && !Array.isArray(paymentDefaultsRaw)
          ? (paymentDefaultsRaw as Record<string, unknown>)
          : {};
      const nextDeposit = Number(paymentDefaults.deposit_percentage ?? 33);
      const nextMidpoint = Number(paymentDefaults.midpoint_percentage ?? 33);
      const nextFinal = Number(paymentDefaults.final_percentage ?? 34);
      setDepositPercentage(String(Number.isFinite(nextDeposit) ? nextDeposit : 33));
      setMidpointPercentage(String(Number.isFinite(nextMidpoint) ? nextMidpoint : 33));
      setFinalPercentage(String(Number.isFinite(nextFinal) ? nextFinal : 34));
    }
  }, [currentAccount?.id, currentAccount?.default_tax_rate, currentAccount?.default_profit_margin, currentAccount?.default_surcharge, currentAccount?.settings]);

  useEffect(() => {
    if (loading) return;
    if (window.location.hash !== "#default-payment-schedule") return;

    const target = document.getElementById("default-payment-schedule");
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading]);

  useEffect(() => {
    if (!currentAccount?.id) return;
    let isCancelled = false;

    const loadTemplates = async () => {
      await migrateLegacyTemplatesToDatabase(currentAccount.id);
      const templates = await getLineItemTemplates(currentAccount.id, { includeBundles: true });
      if (!isCancelled) {
        setLineItemTemplates(templates);
      }
    };

    void loadTemplates();

    return () => {
      isCancelled = true;
    };
  }, [currentAccount?.id]);

  const isDefaultServiceType = (serviceType: string): serviceType is ServiceType => {
    return defaultServiceTypes.includes(serviceType as ServiceType);
  };

  const isProtectedServiceType = (serviceType: string) => serviceType === "other";

  const getServiceTypeLabel = (serviceType: string) => {
    if (isDefaultServiceType(serviceType)) {
      return SERVICE_LABELS[serviceType];
    }

    return titleCaseServiceType(serviceType);
  };

  const resetServiceTypeDraft = () => {
    setServiceTypeDraft({
      name: "",
      unit_type: "sq_ft",
      price_per_unit: "0",
      min_job_size: "0",
      description: "",
    });
    setEditingServiceType(null);
    setShowServiceTypeForm(false);
  };

  const startCreateServiceType = () => {
    setServiceTypeDraft({
      name: "",
      unit_type: "sq_ft",
      price_per_unit: "0",
      min_job_size: "0",
      description: "",
    });
    setEditingServiceType(null);
    setShowServiceTypeForm(true);
  };

  const startEditServiceType = (serviceType: string) => {
    const rule = rules[serviceType];
    if (!rule) return;

    setEditingServiceType(serviceType);
    setServiceTypeDraft({
      name: getServiceTypeLabel(serviceType),
      unit_type: rule.unit_type,
      price_per_unit: String((Number(rule.base_labor_rate) + Number(rule.material_rate)).toFixed(2)),
      min_job_size: String(serviceTypeMinimums[serviceType] ?? 0),
      description: rule.notes || "",
    });
    setShowServiceTypeForm(true);
  };

  const saveServiceTypeDraft = async () => {
    if (!user?.id || !currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const name = serviceTypeDraft.name.trim();
    if (!name) {
      toast.error("Service type name is required");
      return;
    }

    const previousKey = editingServiceType;
    const isEditingDefault = previousKey ? isDefaultServiceType(previousKey) : false;
    const nextKey = previousKey
      ? (isEditingDefault ? previousKey : slugifyServiceType(name))
      : slugifyServiceType(name);

    if (!previousKey && rules[nextKey]) {
      toast.error("A service type with that name already exists");
      return;
    }

    if (previousKey && nextKey !== previousKey && rules[nextKey]) {
      toast.error("A service type with that name already exists");
      return;
    }

    const previousRule = previousKey ? rules[previousKey] : undefined;
    const baseRule = previousRule || {
      ...DEFAULT_PRICING_RULES.other,
      user_id: user.id,
      account_id: currentAccount?.id,
    };

    const nextRule: PricingRule = {
      ...baseRule,
      service_type: nextKey,
      unit_type: serviceTypeDraft.unit_type || "sq_ft",
      base_labor_rate: parseFloat(serviceTypeDraft.price_per_unit) || 0,
      material_rate: 0,
      waste_factor: 0,
      overhead_multiplier: 1,
      profit_margin: 0,
      notes: serviceTypeDraft.description || undefined,
    };
    const parsedMinJobSize = parseFloat(serviceTypeDraft.min_job_size) || 0;

    try {
      const { data: savedRule, error: upsertError } = await supabase
        .from("pricing_rules")
        .upsert({
          user_id: user.id,
          account_id: currentAccount.id,
          service_type: nextRule.service_type,
          base_labor_rate: nextRule.base_labor_rate,
          material_rate: nextRule.material_rate,
          waste_factor: nextRule.waste_factor,
          overhead_multiplier: nextRule.overhead_multiplier,
          profit_margin: nextRule.profit_margin,
          unit_type: nextRule.unit_type,
          notes: nextRule.notes,
        }, { onConflict: "user_id,service_type" })
        .select("*")
        .single();

      if (upsertError) throw upsertError;

      const { data: accountRow, error: accountReadError } = await supabase
        .from("accounts")
        .select("settings")
        .eq("id", currentAccount.id)
        .single();

      if (accountReadError) throw accountReadError;

      const currentSettings = (accountRow?.settings as Record<string, unknown> | null) ?? {};
      const existingMinimumsRaw = currentSettings.min_job_size;
      const existingMinimums = (
        existingMinimumsRaw && typeof existingMinimumsRaw === "object" && !Array.isArray(existingMinimumsRaw)
          ? existingMinimumsRaw
          : {}
      ) as Record<string, unknown>;

      const nextMinimums: Record<string, number> = Object.fromEntries(
        Object.entries(existingMinimums)
          .filter(([key, value]) => typeof key === "string" && typeof value === "number" && Number.isFinite(value)),
      );

      if (previousKey && previousKey !== nextKey) {
        delete nextMinimums[previousKey];
      }
      nextMinimums[nextKey] = Math.max(0, parsedMinJobSize);

      const { error: accountUpdateError } = await supabase
        .from("accounts")
        .update({
          settings: {
            ...currentSettings,
            min_job_size: nextMinimums,
          },
        })
        .eq("id", currentAccount.id);

      if (accountUpdateError) throw accountUpdateError;

      setServiceTypeMinimums(nextMinimums);
      setRules((prev) => {
        const next = { ...prev };
        if (previousKey && previousKey !== nextKey) {
          delete next[previousKey];
        }
        next[nextKey] = {
          ...(savedRule as PricingRule),
          base_labor_rate: Number(savedRule?.base_labor_rate ?? nextRule.base_labor_rate ?? 0),
          material_rate: Number(savedRule?.material_rate ?? nextRule.material_rate ?? 0),
          waste_factor: Number(savedRule?.waste_factor ?? nextRule.waste_factor ?? 0),
          overhead_multiplier: Number(savedRule?.overhead_multiplier ?? nextRule.overhead_multiplier ?? 1),
          profit_margin: Number(savedRule?.profit_margin ?? nextRule.profit_margin ?? 0),
        } as PricingRule;
        return next;
      });

      toast.success(previousKey ? "Service type updated" : "Service type added");
      resetServiceTypeDraft();
    } catch (error) {
      console.error("Error saving service type:", error);
      toast.error("Failed to save service type");
    }
  };

  const deleteServiceType = async (serviceType: string) => {
    if (isProtectedServiceType(serviceType)) {
      toast.error("'Other' service type cannot be deleted");
      return;
    }

    const rule = rules[serviceType];
    if (!rule) return;

    const previousRules = rules;
    const previousOrder = serviceTypeOrder;

    setRules((prev) => {
      const next = { ...prev };
      delete next[serviceType];
      return next;
    });
    setServiceTypeOrder((prev) => prev.filter((value) => value !== serviceType));

    try {
      if (rule.id) {
        const { error } = await supabase
          .from("pricing_rules")
          .delete()
          .eq("id", rule.id);

        if (error) throw error;
      }

      if (currentAccount?.id) {
        const { data: accountRow, error: accountReadError } = await supabase
          .from("accounts")
          .select("settings")
          .eq("id", currentAccount.id)
          .single();

        if (accountReadError) throw accountReadError;

        const currentSettings = (accountRow?.settings as Record<string, unknown> | null) ?? {};
        const existingMinimumsRaw = currentSettings.min_job_size;
        const existingMinimums = (
          existingMinimumsRaw && typeof existingMinimumsRaw === "object" && !Array.isArray(existingMinimumsRaw)
            ? existingMinimumsRaw
            : {}
        ) as Record<string, unknown>;

        const nextMinimums: Record<string, number> = Object.fromEntries(
          Object.entries(existingMinimums)
            .filter(([key, value]) => typeof key === "string" && typeof value === "number" && Number.isFinite(value)),
        );

        delete nextMinimums[serviceType];

        const { error: accountUpdateError } = await supabase
          .from("accounts")
          .update({
            settings: {
              ...currentSettings,
              min_job_size: nextMinimums,
            },
          })
          .eq("id", currentAccount.id);

        if (accountUpdateError) throw accountUpdateError;
        setServiceTypeMinimums(nextMinimums);
      }

      if (editingServiceType === serviceType) {
        resetServiceTypeDraft();
      }

      toast.success("Service type removed");
    } catch (error) {
      console.error("Error deleting service type:", error);
      setRules(previousRules);
      setServiceTypeOrder(previousOrder);
      toast.error("Failed to delete service type");
    }
  };

  const resetToDefaults = (serviceType: ServiceType) => {
    if (!user?.id) return;
    const defaultRule = DEFAULT_PRICING_RULES[serviceType];
    const defaultUnitPrice = Number(defaultRule.base_labor_rate) + Number(defaultRule.material_rate);

    setRules((prev) => ({
      ...prev,
      [serviceType]: {
        ...DEFAULT_PRICING_RULES[serviceType],
        base_labor_rate: Number(defaultUnitPrice.toFixed(2)),
        material_rate: 0,
        waste_factor: 0,
        overhead_multiplier: 1,
        profit_margin: 0,
        id: prev[serviceType]?.id,
        user_id: user.id,
        account_id: currentAccount?.id,
      } as PricingRule,
    }));

    setIsDirty(true);
    toast.success("Reset to defaults - save to apply");
  };

  const refreshTemplates = async () => {
    if (!currentAccount?.id) return;
    const templates = await getLineItemTemplates(currentAccount.id, { includeBundles: true });
    setLineItemTemplates(templates);
  };

  const upsertTemplateInState = (template: LineItemTemplate) => {
    setLineItemTemplates((previous) => {
      const next = [template, ...previous.filter((item) => item.id !== template.id)];
      return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
  };

  const templateOnlyOptions = lineItemTemplates.filter((template) => template.template_type !== "bundle");

  const resetTemplateDraft = () => {
    setTemplateDraft({
      name: "",
      description: "",
      quantity: "1",
      unit: "each",
      unit_price: "0",
      category: "other",
    });
    setEditingTemplateId(null);
    setShowTemplateForm(false);
  };

  const resetBundleDraft = () => {
    setBundleDraft({
      name: "",
      description: "",
      unit: "bundle",
      items: [],
    });
    setEditingBundleId(null);
    setShowBundleForm(false);
    setBundleTemplateQuery("");
  };

  const startCreateTemplate = () => {
    setTemplateDraft({
      name: "",
      description: "",
      quantity: "1",
      unit: "each",
      unit_price: "0",
      category: "other",
    });
    setEditingTemplateId(null);
    setShowTemplateForm(true);
  };

  const startCreateBundle = () => {
    setBundleDraft({
      name: "",
      description: "",
      unit: "bundle",
      items: [],
    });
    setEditingBundleId(null);
    setShowBundleForm(true);
    setBundleTemplateQuery("");
  };

  const startEditTemplate = (template: LineItemTemplate) => {
    if (template.template_type === "bundle") {
      setEditingBundleId(template.id);
      setBundleDraft({
        name: template.name,
        description: template.description || "",
        unit: template.unit || "bundle",
        items: template.bundle_items.length > 0
          ? template.bundle_items.map((item) => ({
            template_id: item.template_id,
            quantity_per_unit: item.quantity_per_unit || "1",
          }))
          : [],
      });
      setShowBundleForm(true);
      setBundleTemplateQuery("");
      return;
    }

    setEditingTemplateId(template.id);
    setTemplateDraft({
      name: template.name,
      description: template.description || "",
      quantity: template.quantity || "1",
      unit: template.unit || "each",
      unit_price: template.unit_price || "0",
      category: template.category || "other",
    });
    setShowTemplateForm(true);
  };

  const updateBundleItemByTemplate = (templateId: string, patch: Partial<BundleDraftItem>) => {
    setBundleDraft((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.template_id === templateId
          ? { ...item, ...patch }
          : item,
      ),
    }));
  };

  const toggleBundleTemplate = (templateId: string, enabled: boolean) => {
    if (enabled) {
      setBundleDraft((previous) => {
        if (previous.items.some((item) => item.template_id === templateId)) {
          return previous;
        }

        return {
          ...previous,
          items: [
            ...previous.items,
            {
              template_id: templateId,
              quantity_per_unit: "1",
            },
          ],
        };
      });
      return;
    }

    setBundleDraft((previous) => ({
      ...previous,
      items: previous.items.filter((item) => item.template_id !== templateId),
    }));
  };

  const normalizeBundleItems = (items: BundleDraftItem[]): LineItemBundleItem[] => {
    const seen = new Set<string>();
    return items
      .map((item) => ({
        template_id: item.template_id,
        quantity_per_unit: item.quantity_per_unit || "0",
      }))
      .filter((item) => {
        const quantity = Number(item.quantity_per_unit);
        if (!item.template_id || !Number.isFinite(quantity) || quantity <= 0) return false;
        if (seen.has(item.template_id)) return false;
        seen.add(item.template_id);
        return true;
      });
  };

  const selectedBundleTemplateIds = new Set(bundleDraft.items.map((item) => item.template_id));
  const filteredBundleTemplateOptions = templateOnlyOptions.filter((template) => {
    if (selectedBundleTemplateIds.has(template.id)) return false;
    if (!bundleTemplateQuery.trim()) return true;
    const query = bundleTemplateQuery.trim().toLowerCase();
    return (
      template.name.toLowerCase().includes(query)
      || (template.description || "").toLowerCase().includes(query)
    );
  });

  const saveTemplateDraft = async () => {
    const name = templateDraft.name.trim();
    if (!name) {
      toast.error("Template title is required");
      return;
    }

    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const payload = {
      name,
      description: templateDraft.description,
      quantity: templateDraft.quantity || "1",
      unit: templateDraft.unit || "each",
      unit_price: templateDraft.unit_price || "0",
      category: templateDraft.category || "other",
      template_type: "template" as const,
      bundle_items: [],
    };

    if (editingTemplateId) {
      const updated = await updateLineItemTemplate(editingTemplateId, payload);
      if (!updated) {
        toast.error("Failed to update template");
        return;
      }
      upsertTemplateInState(updated);
      void refreshTemplates();
      toast.success("Template updated");
      resetTemplateDraft();
      return;
    }

    const created = await createLineItemTemplate(currentAccount.id, payload);
    if (!created) {
      toast.error("Failed to add template");
      return;
    }
    upsertTemplateInState(created);
    void refreshTemplates();
    toast.success("Template added");
    resetTemplateDraft();
  };

  const saveBundleDraft = async () => {
    const name = bundleDraft.name.trim();
    if (!name) {
      toast.error("Bundle title is required");
      return;
    }

    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const normalizedItems = normalizeBundleItems(bundleDraft.items);
    if (normalizedItems.length === 0) {
      toast.error("Add at least one connected template with quantity");
      return;
    }

    const payload = {
      name,
      description: bundleDraft.description,
      quantity: "1",
      unit: bundleDraft.unit.trim() || "bundle",
      unit_price: "0",
      category: "other",
      template_type: "bundle" as const,
      bundle_items: normalizedItems,
    };

    if (editingBundleId) {
      const updated = await updateLineItemTemplate(editingBundleId, payload);
      if (!updated) {
        toast.error("Failed to update bundle");
        return;
      }
      upsertTemplateInState(updated);
      void refreshTemplates();
      toast.success("Bundle updated");
      resetBundleDraft();
      return;
    }

    const created = await createLineItemTemplate(currentAccount.id, payload);
    if (!created) {
      toast.error("Failed to add bundle");
      return;
    }
    upsertTemplateInState(created);
    void refreshTemplates();
    toast.success("Bundle added");
    resetBundleDraft();
  };

  const deleteTemplate = async (id: string) => {
    const deleted = await deleteLineItemTemplate(id);
    if (!deleted) {
      toast.error("Failed to delete template");
      return;
    }
    if (currentAccount?.id) {
      await refreshTemplates();
    } else {
      setLineItemTemplates((prev) => prev.filter((template) => template.id !== id));
    }
    if (editingTemplateId === id) {
      resetTemplateDraft();
    }
    if (editingBundleId === id) {
      resetBundleDraft();
    }
    toast.success("Template deleted");
  };

  const fetchRules = async () => {
    if (!user?.id || !currentAccount?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("account_id", currentAccount.id)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to load pricing rules");
      setLoading(false);
      return;
    }

    const { data: accountRow, error: accountError } = await supabase
      .from("accounts")
      .select("settings")
      .eq("id", currentAccount.id)
      .maybeSingle();

    if (accountError) {
      console.error("Error fetching account settings:", accountError);
      toast.error("Failed to load pricing rules");
      setLoading(false);
      return;
    }

    const settings = (accountRow?.settings as Record<string, unknown> | null) ?? {};
    const minJobSize = settings.min_job_size;
    const initialMinimums: Record<string, number> = (
      minJobSize && typeof minJobSize === "object" && !Array.isArray(minJobSize)
        ? Object.fromEntries(
          Object.entries(minJobSize as Record<string, unknown>)
            .filter(([key, value]) => typeof key === "string" && typeof value === "number" && Number.isFinite(value)),
        )
        : {}
    ) as Record<string, number>;

    const initialRules: Record<string, PricingRule> = {};

    (data || []).forEach((rule) => {
      if (initialRules[rule.service_type]) return;
      const combinedUnitPrice = Number(rule.base_labor_rate ?? 0) + Number(rule.material_rate ?? 0);
      initialRules[rule.service_type] = {
        ...(rule as PricingRule),
        base_labor_rate: Number.isFinite(combinedUnitPrice) ? combinedUnitPrice : 0,
        material_rate: 0,
        waste_factor: 0,
        overhead_multiplier: 1,
        profit_margin: 0,
      };
    });

    // Keep "other" available as a required fallback service type.
    if (!initialRules.other) {
      initialRules.other = {
        ...DEFAULT_PRICING_RULES.other,
        user_id: user.id,
        account_id: currentAccount.id,
      } as PricingRule;
    }

    const defaultServiceTypeOrder = defaultServiceTypes.filter((serviceType) => Boolean(initialRules[serviceType]));
    const customServiceTypeOrder = Object.keys(initialRules).filter(
      (serviceType) => !isDefaultServiceType(serviceType),
    );

    const orderedServiceTypes = [
      ...defaultServiceTypeOrder.filter((serviceType) => serviceType !== "other"),
      "other",
      ...customServiceTypeOrder.filter((serviceType) => serviceType !== "other"),
    ];

    setRules(initialRules);
    setServiceTypeMinimums(initialMinimums);
    setServiceTypeOrder(orderedServiceTypes);
    setEditingServiceType(null);
    setShowServiceTypeForm(false);
    setServiceTypeDraft({
      name: "",
      unit_type: "sq_ft",
      price_per_unit: "0",
      min_job_size: "0",
      description: "",
    });
    setLoading(false);
  };

  const saveRules = async () => {
    if (!user?.id || !currentAccount?.id) return false;

    setSaving(true);

    try {
      const parsedTax = parseFloat(taxRate) || 0;
      const parsedProfitMargin = parseFloat(profitMargin) || 0;
      const parsedSurcharge = parseFloat(surcharge) || 0;
      const parsedDepositPercentage = parseFloat(depositPercentage) || 0;
      const parsedMidpointPercentage = parseFloat(midpointPercentage) || 0;
      const parsedFinalPercentage = parseFloat(finalPercentage) || 0;
      const paymentScheduleTotal = parsedDepositPercentage + parsedMidpointPercentage + parsedFinalPercentage;

      if (
        parsedDepositPercentage < 0
        || parsedMidpointPercentage < 0
        || parsedFinalPercentage < 0
        || Math.abs(paymentScheduleTotal - 100) > 0.01
      ) {
        toast.error("Default payment schedule must be non-negative and total 100%");
        return false;
      }

      const { error: defaultsError } = await supabase
        .from("accounts")
        .update({
          default_tax_rate: parsedTax,
          default_profit_margin: parsedProfitMargin,
          default_surcharge: parsedSurcharge,
        })
        .eq("id", currentAccount.id);

      if (defaultsError) throw defaultsError;

      for (const serviceType of serviceTypeOrder) {
        const rule = rules[serviceType];
        if (!rule) continue;

        const { error } = await supabase
          .from("pricing_rules")
          .upsert({
            user_id: user.id,
            account_id: currentAccount.id,
            service_type: rule.service_type,
            base_labor_rate: rule.base_labor_rate,
            material_rate: rule.material_rate,
            waste_factor: rule.waste_factor,
            overhead_multiplier: rule.overhead_multiplier,
            profit_margin: rule.profit_margin,
            unit_type: rule.unit_type,
            notes: rule.notes,
          }, { onConflict: "user_id,service_type" });

        if (error) throw error;
      }

      // Keep website calculator services/rates aligned with Pricing Rules.
      const { data: accountRow, error: accountReadError } = await supabase
        .from("accounts")
        .select("settings")
        .eq("id", currentAccount.id)
        .single();

      if (accountReadError) throw accountReadError;

      const currentSettings = (accountRow?.settings as Record<string, unknown> | null) ?? {};
      const currentWebsite = (currentSettings.website as Record<string, unknown> | undefined) ?? {};
      const existingServices = Array.isArray(currentWebsite.services)
        ? (currentWebsite.services as Array<Record<string, unknown>>)
        : [];

      const existingByName = new Map(
        existingServices
          .map((service) => {
            const name = String(service.name ?? "").trim();
            return [name, service] as const;
          })
          .filter(([name]) => name.length > 0),
      );

      const websiteServices = serviceTypeOrder.flatMap((serviceType) => {
        const rule = rules[serviceType];
        if (!rule) return [];

        const name = getServiceTypeLabel(serviceType);
        if (name === "Other") return [];

        const existing = existingByName.get(name);
        return [{
          id: serviceType,
          name,
          description: String(rule.notes ?? existing?.description ?? ""),
          icon: String(existing?.icon ?? "CheckCircle2"),
          enabled: existing?.enabled !== false,
          price_per_unit: Number((Number(rule.base_labor_rate) + Number(rule.material_rate)).toFixed(2)),
          unit_type: String(rule.unit_type || "sq_ft"),
        }];
      });

      const { error: accountUpdateError } = await supabase
        .from("accounts")
        .update({
          settings: {
            ...currentSettings,
            default_payment_schedule: {
              deposit_percentage: parsedDepositPercentage,
              midpoint_percentage: parsedMidpointPercentage,
              final_percentage: parsedFinalPercentage,
            },
            website: {
              ...currentWebsite,
              services: websiteServices,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentAccount.id);

      if (accountUpdateError) throw accountUpdateError;

      setIsDirty(false);
      toast.success("Pricing rules saved");
      await refreshProfile();
      await fetchRules();
      return true;
    } catch (error) {
      console.error("Error saving rules:", error);
      toast.error("Failed to save pricing rules");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Pricing Rules"
        showBack
        backTo="/settings"
      />

      <main className="max-w-[var(--content-max-width)] m-auto px-4 py-4">
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card-elevated rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-2xl font-medium flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-muted-foreground" />
                    Default Pricing
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Applied automatically to new estimates (editable per estimate)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      Default Tax Rate
                    </h4>
                  </div>
                  <div className="relative w-28">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) => {
                        setTaxRate(event.target.value);
                        setIsDirty(true);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <HandCoins className="h-4 w-4 text-muted-foreground" />
                      Default Profit Margin
                    </h4>
                  </div>
                  <div className="relative w-28">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={profitMargin}
                      onChange={(event) => {
                        setProfitMargin(event.target.value);
                        setIsDirty(true);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                      Default Surcharge
                    </h4>
                  </div>
                  <div className="relative w-28">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={surcharge}
                      onChange={(event) => {
                        setSurcharge(event.target.value);
                        setIsDirty(true);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>

                <div id="default-payment-schedule" className="space-y-2 rounded-md border border-border/70 p-3">
                  <h4 className="font-medium">Default Payment Schedule</h4>
                  <p className="text-xs text-muted-foreground">
                    Used in proposal agreements. Deposit + midpoint + final must total 100%.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="deposit-percentage">Deposit %</Label>
                      <Input
                        id="deposit-percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={depositPercentage}
                        onChange={(event) => {
                          setDepositPercentage(event.target.value);
                          setIsDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="midpoint-percentage">Midpoint %</Label>
                      <Input
                        id="midpoint-percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={midpointPercentage}
                        onChange={(event) => {
                          setMidpointPercentage(event.target.value);
                          setIsDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="final-percentage">Final %</Label>
                      <Input
                        id="final-percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={finalPercentage}
                        onChange={(event) => {
                          setFinalPercentage(event.target.value);
                          setIsDirty(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-elevated rounded-lg p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-medium flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      Reusable Estimate Items
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Manage reusable templates shown in Quick Add.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowTemplateImportModal(true)}>
                      <Upload className="h-4 w-4 mr-1" />
                      Import CSV
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowTemplateTypeDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {lineItemTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No templates or bundles yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {lineItemTemplates.map((template) => (
                      <div key={template.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.template_type === "bundle" ? "Bundle" : "Template"}
                          </p>
                          {template.description ? (
                            <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
                          ) : null}
                          {template.template_type === "bundle" ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.bundle_items.length} connected template{template.bundle_items.length === 1 ? "" : "s"} • unit: {template.unit || "bundle"}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.quantity} x ${Number(template.unit_price || 0).toFixed(2)} / {template.unit}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" variant="ghost" size="icon" onClick={() => startEditTemplate(template)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteTemplate(template.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-elevated rounded-lg p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-medium flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                      Service Types
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Manage default and custom service types used in pricing rules.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={startCreateServiceType}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Service Type
                  </Button>
                </div>

                {serviceTypeOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No service types yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {serviceTypeOrder.map((serviceType) => {
                      const rule = rules[serviceType];
                      if (!rule) return null;

                      const isDefault = isDefaultServiceType(serviceType);
                      const isProtected = isProtectedServiceType(serviceType);
                      const unitPrice = Number(rule.base_labor_rate) + Number(rule.material_rate);
                      const displayUnit = normalizeServiceTypeUnitForDisplay(rule.unit_type);
                      const displayNotes = getServiceTypeNotesForDisplay(rule.notes, rule.unit_type);

                      return (
                        <div key={serviceType} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{getServiceTypeLabel(serviceType)}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {isDefault ? "Default service type" : "Custom service type"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ${unitPrice.toFixed(2)} / {displayUnit}{displayNotes ? ` • ${displayNotes}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={() => startEditServiceType(serviceType)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!isProtected && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteServiceType(serviceType)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <StickyActionBar onSave={saveRules} isSaving={saving} contentClassName="max-w-[var(--content-max-width)] m-auto" />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} onSaveAndLeave={saveRules} />
      <LineItemTemplateCSVImportModal
        open={showTemplateImportModal}
        onOpenChange={setShowTemplateImportModal}
        onImportComplete={() => {
          void refreshTemplates();
        }}
      />
      <Dialog open={showTemplateTypeDialog} onOpenChange={setShowTemplateTypeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Choose whether you want to add a single template or a multi-item bundle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setShowTemplateTypeDialog(false);
                startCreateTemplate();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Template
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setShowTemplateTypeDialog(false);
                startCreateBundle();
              }}
            >
              <Package className="h-4 w-4 mr-2" />
              Bundle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showTemplateForm}
        onOpenChange={(open) => {
          if (!open) {
            resetTemplateDraft();
          } else {
            setShowTemplateForm(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? "Edit Template" : "Add Template"}</DialogTitle>
            <DialogDescription>
              Configure reusable line item template details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="template-name">Title *</Label>
              <Input
                id="template-name"
                value={templateDraft.name}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g., Black Mulch"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={templateDraft.description}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="template-quantity">Quantity</Label>
              <Input
                id="template-quantity"
                type="number"
                step="0.01"
                value={templateDraft.quantity}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, quantity: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="template-price">Unit Price</Label>
              <Input
                id="template-price"
                type="number"
                step="0.01"
                value={templateDraft.unit_price}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, unit_price: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="template-unit">Unit</Label>
              <UnitSelect
                id="template-unit"
                value={templateDraft.unit}
                options={LINE_ITEM_UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onValueChange={(value) =>
                  setTemplateDraft((prev) => ({ ...prev, unit: value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="template-category">Category</Label>
              <Select
                value={templateDraft.category}
                onValueChange={(value) =>
                  setTemplateDraft((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="materials">Materials</SelectItem>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={saveTemplateDraft}>
              <Save className="h-4 w-4 mr-1" />
              {editingTemplateId ? "Update Template" : "Save Template"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetTemplateDraft}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showBundleForm}
        onOpenChange={(open) => {
          if (!open) {
            resetBundleDraft();
          } else {
            setShowBundleForm(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBundleId ? "Edit Bundle" : "Add Bundle"}</DialogTitle>
            <DialogDescription>
              Each bundle unit adds each connected template by its quantity per unit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="bundle-name">Title *</Label>
              <Input
                id="bundle-name"
                value={bundleDraft.name}
                onChange={(event) =>
                  setBundleDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g., Spring Cleanup Package"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bundle-description">Description</Label>
              <Input
                id="bundle-description"
                value={bundleDraft.description}
                onChange={(event) =>
                  setBundleDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="bundle-unit">Bundle Unit</Label>
              <UnitSelect
                id="bundle-unit"
                value={bundleDraft.unit}
                options={UNIT_SELECT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onValueChange={(value) =>
                  setBundleDraft((prev) => ({ ...prev, unit: value }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Connected Templates</Label>

            {templateOnlyOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create at least one template before creating bundles.</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="rounded-md border border-border">
                    <LineItemTemplateSearch
                      placeholder="Search item labels..."
                      emptyText={bundleTemplateQuery.trim() ? "No matching labels" : "All templates already added."}
                      query={bundleTemplateQuery}
                      onQueryChange={setBundleTemplateQuery}
                      hideListUntilQuery
                      sections={[
                        {
                          heading: "Your Templates",
                          items: filteredBundleTemplateOptions.map((template) => ({
                            id: template.id,
                            value: `${template.name} ${template.description || ""}`,
                            primary: template.name,
                            rightText: `$${Number(template.unit_price || 0).toFixed(2)}`,
                            onSelect: () => {
                              toggleBundleTemplate(template.id, true);
                              setBundleTemplateQuery("");
                            },
                          })),
                        },
                      ]}
                    />
                  </div>
                </div>

                {bundleDraft.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No connected templates yet.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Adding 1 <span className="text-foreground font-medium">{bundleDraft.unit.trim() || "bundle"}</span> of{" "}
                      <span className="text-foreground font-medium">{bundleDraft.name.trim() || "bundle"}</span> will add:
                    </p>
                    {bundleDraft.items.map((item) => {
                      const template = templateOnlyOptions.find((option) => option.id === item.template_id);
                      if (!template) return null;

                      return (
                        <div key={template.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{template.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {template.quantity} x ${Number(template.unit_price || 0).toFixed(2)} / {template.unit}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                id={`bundle-item-quantity-${template.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`Units per bundle for ${template.name}`}
                                className="h-9 w-20"
                                value={item.quantity_per_unit}
                                onChange={(event) => updateBundleItemByTemplate(template.id, { quantity_per_unit: event.target.value })}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{template.unit}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => toggleBundleTemplate(template.id, false)}
                                aria-label={`Remove ${template.name} from bundle`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={saveBundleDraft} disabled={templateOnlyOptions.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              {editingBundleId ? "Update Bundle" : "Save Bundle"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetBundleDraft}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showServiceTypeForm}
        onOpenChange={(open) => {
          if (!open) {
            resetServiceTypeDraft();
          } else {
            setShowServiceTypeForm(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingServiceType ? "Edit Service Type" : "Add Service Type"}</DialogTitle>
            <DialogDescription>
              Configure service details for this service type.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="service-type-name">Service Type Name *</Label>
              <Input
                id="service-type-name"
                value={serviceTypeDraft.name}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g., Irrigation"
              />
            </div>

            <div>
              <Label htmlFor="service-type-unit">Unit Type</Label>
              <UnitSelect
                id="service-type-unit"
                value={serviceTypeDraft.unit_type}
                options={SERVICE_TYPE_UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onValueChange={(value) =>
                  setServiceTypeDraft((prev) => ({ ...prev, unit_type: value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-price">Price Per Unit</Label>
              <Input
                id="service-type-price"
                type="number"
                step="0.01"
                value={serviceTypeDraft.price_per_unit}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, price_per_unit: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-min-job-size">Minimum Job Size ($)</Label>
              <Input
                id="service-type-min-job-size"
                type="number"
                min="0"
                step="0.01"
                value={serviceTypeDraft.min_job_size}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, min_job_size: event.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="service-type-description">Description</Label>
              <Input
                id="service-type-description"
                value={serviceTypeDraft.description}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={saveServiceTypeDraft}>
              <Save className="h-4 w-4 mr-1" />
              {editingServiceType ? "Update Service Type" : "Save Service Type"}
            </Button>

            {editingServiceType && isDefaultServiceType(editingServiceType) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => resetToDefaults(editingServiceType)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset to Default
              </Button>
            )}

            <Button type="button" variant="ghost" onClick={resetServiceTypeDraft}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
