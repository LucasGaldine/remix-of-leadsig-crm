import { useState, useEffect } from "react";
import { RotateCcw, Loader as Loader2, Plus, Pencil, Trash2, Save, X, Upload } from "lucide-react";
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
  type LineItemTemplate,
} from "@/lib/lineItemTemplates";
import { LineItemTemplateCSVImportModal } from "@/components/settings/LineItemTemplateCSVImportModal";

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
  base_labor_rate: string;
  material_rate: string;
  waste_factor: string;
  overhead_multiplier: string;
  profit_margin: string;
  notes: string;
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

export default function SettingsPricingRules() {
  const { user, currentAccount, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);
  const defaultServiceTypes = Object.keys(DEFAULT_PRICING_RULES) as ServiceType[];
  const [rules, setRules] = useState<Record<string, PricingRule>>({});
  const [serviceTypeOrder, setServiceTypeOrder] = useState<string[]>([]);
  const [editingServiceType, setEditingServiceType] = useState<string | null>(null);
  const [showServiceTypeForm, setShowServiceTypeForm] = useState(false);
  const [serviceTypeDraft, setServiceTypeDraft] = useState<ServiceTypeDraft>({
    name: "",
    unit_type: "sq_ft",
    base_labor_rate: "0",
    material_rate: "0",
    waste_factor: "10",
    overhead_multiplier: "1.15",
    profit_margin: "20",
    notes: "",
  });
  const [taxRate, setTaxRate] = useState<string>("");
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [surcharge, setSurcharge] = useState<string>("");
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const [showTemplateImportModal, setShowTemplateImportModal] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    description: "",
    quantity: "1",
    unit: "each",
    unit_price: "0",
    category: "other",
  });

  useEffect(() => {
    void fetchRules();
  }, [user?.id, currentAccount?.id]);

  useEffect(() => {
    if (currentAccount) {
      setTaxRate(String(currentAccount.default_tax_rate ?? 8));
      setProfitMargin(String(currentAccount.default_profit_margin ?? 0));
      setSurcharge(String(currentAccount.default_surcharge ?? 0));
    }
  }, [currentAccount?.id, currentAccount?.default_tax_rate, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

  useEffect(() => {
    if (!currentAccount?.id) return;
    let isCancelled = false;

    const loadTemplates = async () => {
      await migrateLegacyTemplatesToDatabase(currentAccount.id);
      const templates = await getLineItemTemplates(currentAccount.id);
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
      base_labor_rate: "0",
      material_rate: "0",
      waste_factor: "10",
      overhead_multiplier: "1.15",
      profit_margin: "20",
      notes: "",
    });
    setEditingServiceType(null);
    setShowServiceTypeForm(false);
  };

  const startCreateServiceType = () => {
    setServiceTypeDraft({
      name: "",
      unit_type: "sq_ft",
      base_labor_rate: "0",
      material_rate: "0",
      waste_factor: "10",
      overhead_multiplier: "1.15",
      profit_margin: "20",
      notes: "",
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
      base_labor_rate: String(rule.base_labor_rate),
      material_rate: String(rule.material_rate),
      waste_factor: String(rule.waste_factor),
      overhead_multiplier: String(rule.overhead_multiplier),
      profit_margin: String(rule.profit_margin),
      notes: rule.notes || "",
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
      base_labor_rate: parseFloat(serviceTypeDraft.base_labor_rate) || 0,
      material_rate: parseFloat(serviceTypeDraft.material_rate) || 0,
      waste_factor: parseFloat(serviceTypeDraft.waste_factor) || 0,
      overhead_multiplier: parseFloat(serviceTypeDraft.overhead_multiplier) || 1,
      profit_margin: parseFloat(serviceTypeDraft.profit_margin) || 0,
      notes: serviceTypeDraft.notes || undefined,
    };

    try {
      if (previousRule?.id) {
        const { error } = await supabase
          .from("pricing_rules")
          .update({
            service_type: nextRule.service_type,
            base_labor_rate: nextRule.base_labor_rate,
            material_rate: nextRule.material_rate,
            waste_factor: nextRule.waste_factor,
            overhead_multiplier: nextRule.overhead_multiplier,
            profit_margin: nextRule.profit_margin,
            unit_type: nextRule.unit_type,
            notes: nextRule.notes,
          })
          .eq("id", previousRule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pricing_rules")
          .insert({
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
          });

        if (error) throw error;
      }

      toast.success(previousKey ? "Service type updated" : "Service type added");
      resetServiceTypeDraft();
      await fetchRules();
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

    setRules((prev) => ({
      ...prev,
      [serviceType]: {
        ...DEFAULT_PRICING_RULES[serviceType],
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
    const templates = await getLineItemTemplates(currentAccount.id);
    setLineItemTemplates(templates);
  };

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

  const startEditTemplate = (template: LineItemTemplate) => {
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
    };

    if (editingTemplateId) {
      const updated = await updateLineItemTemplate(editingTemplateId, payload);
      if (!updated) {
        toast.error("Failed to update template");
        return;
      }
      await refreshTemplates();
      toast.success("Template updated");
      resetTemplateDraft();
      return;
    }

    const created = await createLineItemTemplate(currentAccount.id, payload);
    if (!created) {
      toast.error("Failed to add template");
      return;
    }
    await refreshTemplates();
    toast.success("Template added");
    resetTemplateDraft();
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
    toast.success("Template deleted");
  };

  const fetchRules = async () => {
    if (!user?.id || !currentAccount?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("account_id", currentAccount.id);

    if (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to load pricing rules");
      setLoading(false);
      return;
    }

    const initialRules: Record<string, PricingRule> = {};

    (data || []).forEach((rule) => {
      initialRules[rule.service_type] = rule as PricingRule;
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
    setServiceTypeOrder(orderedServiceTypes);
    setEditingServiceType(null);
    setShowServiceTypeForm(false);
    setServiceTypeDraft({
      name: "",
      unit_type: "sq_ft",
      base_labor_rate: "0",
      material_rate: "0",
      waste_factor: "10",
      overhead_multiplier: "1.15",
      profit_margin: "20",
      notes: "",
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

        if (rule.id) {
          const { error } = await supabase
            .from("pricing_rules")
            .update({
              service_type: rule.service_type,
              base_labor_rate: rule.base_labor_rate,
              material_rate: rule.material_rate,
              waste_factor: rule.waste_factor,
              overhead_multiplier: rule.overhead_multiplier,
              profit_margin: rule.profit_margin,
              unit_type: rule.unit_type,
              notes: rule.notes,
            })
            .eq("id", rule.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("pricing_rules")
            .insert({
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
            });

          if (error) throw error;
        }
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
        const computedRate =
          (Number(rule.base_labor_rate) + Number(rule.material_rate)) *
          (1 + Number(rule.waste_factor) / 100) *
          Number(rule.overhead_multiplier) *
          (1 + Number(rule.profit_margin) / 100);

        return [{
          id: serviceType,
          name,
          description: String(existing?.description ?? ""),
          icon: String(existing?.icon ?? "CheckCircle2"),
          price_per_unit: Number(computedRate.toFixed(2)),
          unit_type: String(rule.unit_type || "sq_ft"),
        }];
      });

      const { error: accountUpdateError } = await supabase
        .from("accounts")
        .update({
          settings: {
            ...currentSettings,
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
                  <h3 className="font-medium">Estimate Defaults</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Applied automatically to new estimates (editable per estimate)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Default Tax Rate</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Applied automatically to new estimates
                    </p>
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
                    <h4 className="font-medium">Default Profit Margin</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Applied automatically to new estimates (editable per estimate)
                    </p>
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
                    <h4 className="font-medium">Default Surcharge</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Applied automatically to new estimates (editable per estimate)
                    </p>
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
              </div>

              <div className="card-elevated rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Line Item Templates</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Manage reusable templates shown in Quick Add.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowTemplateImportModal(true)}>
                      <Upload className="h-4 w-4 mr-1" />
                      Import CSV
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={startCreateTemplate}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Template
                    </Button>
                  </div>
                </div>

                {lineItemTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No templates yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {lineItemTemplates.map((template) => (
                      <div key={template.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{template.name}</p>
                          {template.description ? (
                            <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.quantity} x ${Number(template.unit_price || 0).toFixed(2)} / {template.unit}
                          </p>
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
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Service Types</h3>
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

                      const isLinearFeet = rule.unit_type === "linear_ft";
                      const isDefault = isDefaultServiceType(serviceType);
                      const isProtected = isProtectedServiceType(serviceType);

                      return (
                        <div key={serviceType} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{getServiceTypeLabel(serviceType)}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {isDefault ? "Default service type" : "Custom service type"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ${rule.base_labor_rate.toFixed(2)} labor + ${rule.material_rate.toFixed(2)} materials / {isLinearFeet ? "linear ft" : "sq ft"} • {rule.profit_margin}% profit
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
              <Select
                value={templateDraft.unit}
                onValueChange={(value) =>
                  setTemplateDraft((prev) => ({ ...prev, unit: value }))
                }
              >
                <SelectTrigger id="template-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="sq ft">Sq Ft</SelectItem>
                  <SelectItem value="linear ft">Linear Ft</SelectItem>
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
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
              Configure pricing defaults for this service type.
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
              <Select
                value={serviceTypeDraft.unit_type}
                onValueChange={(value) =>
                  setServiceTypeDraft((prev) => ({ ...prev, unit_type: value }))
                }
              >
                <SelectTrigger id="service-type-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sq_ft">Square Feet</SelectItem>
                  <SelectItem value="linear_ft">Linear Feet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="service-type-labor">Labor Rate</Label>
              <Input
                id="service-type-labor"
                type="number"
                step="0.01"
                value={serviceTypeDraft.base_labor_rate}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, base_labor_rate: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-material">Material Rate</Label>
              <Input
                id="service-type-material"
                type="number"
                step="0.01"
                value={serviceTypeDraft.material_rate}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, material_rate: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-waste">Waste Factor (%)</Label>
              <Input
                id="service-type-waste"
                type="number"
                step="0.01"
                value={serviceTypeDraft.waste_factor}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, waste_factor: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-overhead">Overhead Multiplier</Label>
              <Input
                id="service-type-overhead"
                type="number"
                step="0.01"
                value={serviceTypeDraft.overhead_multiplier}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, overhead_multiplier: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="service-type-profit">Profit Margin (%)</Label>
              <Input
                id="service-type-profit"
                type="number"
                step="0.01"
                value={serviceTypeDraft.profit_margin}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, profit_margin: event.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="service-type-notes">Notes</Label>
              <Input
                id="service-type-notes"
                value={serviceTypeDraft.notes}
                onChange={(event) =>
                  setServiceTypeDraft((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Optional notes"
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
