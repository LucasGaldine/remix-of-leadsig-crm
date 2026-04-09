import { useState, useEffect } from "react";
import { Calculator, RotateCcw, Loader as Loader2, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  DEFAULT_PRICING_RULES, 
  SERVICE_LABELS, 
  ServiceType 
} from "@/hooks/useQuickEstimate";
import { loadGlobalLineItemTemplates, saveGlobalLineItemTemplates, type LineItemTemplate } from "@/lib/lineItemTemplates";

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

export default function SettingsPricingRules() {
  const { user, currentAccount, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);
  const [rules, setRules] = useState<Record<ServiceType, PricingRule>>({} as Record<ServiceType, PricingRule>);
  const pricingServiceTypes = Object.keys(DEFAULT_PRICING_RULES) as ServiceType[];
  const [activeTab, setActiveTab] = useState<ServiceType>(pricingServiceTypes[0] || "pavers");
  const [taxRate, setTaxRate] = useState<string>("");
  const [profitMargin, setProfitMargin] = useState<string>("");
  const [surcharge, setSurcharge] = useState<string>("");
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
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
    fetchRules();
  }, [user?.id, currentAccount?.id]);

  useEffect(() => {
    if (currentAccount) {
      setTaxRate(String(currentAccount.default_tax_rate ?? 8));
      setProfitMargin(String(currentAccount.default_profit_margin ?? 0));
      setSurcharge(String(currentAccount.default_surcharge ?? 0));
      setLineItemTemplates(loadGlobalLineItemTemplates(currentAccount.id));
    }
  }, [currentAccount?.id, currentAccount?.default_tax_rate, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

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
  };

  const startCreateTemplate = () => {
    resetTemplateDraft();
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
  };

  const persistTemplates = (nextTemplates: LineItemTemplate[]) => {
    setLineItemTemplates(nextTemplates);
    saveGlobalLineItemTemplates(nextTemplates);
  };

  const saveTemplateDraft = () => {
    const name = templateDraft.name.trim();
    if (!name) {
      toast.error("Template title is required");
      return;
    }

    const now = new Date().toISOString();

    if (editingTemplateId) {
      const updatedTemplates = lineItemTemplates.map((template) => {
        if (template.id !== editingTemplateId) return template;
        return {
          ...template,
          name,
          description: templateDraft.description,
          quantity: templateDraft.quantity || "1",
          unit: templateDraft.unit || "each",
          unit_price: templateDraft.unit_price || "0",
          category: templateDraft.category || "other",
          created_at: now,
        };
      });
      persistTemplates(updatedTemplates);
      toast.success("Template updated");
      resetTemplateDraft();
      return;
    }

    const newTemplate: LineItemTemplate = {
      id: crypto.randomUUID(),
      name,
      description: templateDraft.description,
      quantity: templateDraft.quantity || "1",
      unit: templateDraft.unit || "each",
      unit_price: templateDraft.unit_price || "0",
      category: templateDraft.category || "other",
      created_at: now,
    };

    persistTemplates([newTemplate, ...lineItemTemplates]);
    toast.success("Template added");
    resetTemplateDraft();
  };

  const deleteTemplate = (id: string) => {
    const nextTemplates = lineItemTemplates.filter((template) => template.id !== id);
    persistTemplates(nextTemplates);
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

    // Initialize with defaults and merge with saved rules
    const initialRules: Record<ServiceType, PricingRule> = {} as Record<ServiceType, PricingRule>;
    
    pricingServiceTypes.forEach((serviceType) => {
      const savedRule = data?.find((r) => r.service_type === serviceType);
      if (savedRule) {
        initialRules[serviceType] = savedRule as PricingRule;
      } else {
        initialRules[serviceType] = {
          ...DEFAULT_PRICING_RULES[serviceType],
          user_id: user.id,
        } as PricingRule;
      }
    });

    setRules(initialRules);
    setLoading(false);
  };

  const updateRule = (serviceType: ServiceType, field: keyof PricingRule, value: number | string) => {
    setRules((prev) => ({
      ...prev,
      [serviceType]: {
        ...prev[serviceType],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const saveRules = async () => {
    if (!user?.id || !currentAccount?.id) return;

    setSaving(true);

    try {
      const parsedTax = parseFloat(taxRate) || 0;
      const parsedProfitMargin = parseFloat(profitMargin) || 0;
      const parsedSurcharge = parseFloat(surcharge) || 0;
      const { error: taxError } = await supabase
        .from("accounts")
        .update({
          default_tax_rate: parsedTax,
          default_profit_margin: parsedProfitMargin,
          default_surcharge: parsedSurcharge,
        })
        .eq("id", currentAccount.id);

      if (taxError) throw taxError;

      for (const serviceType of pricingServiceTypes) {
        const rule = rules[serviceType];

        if (rule.id) {
          // Update existing rule
          const { error } = await supabase
            .from("pricing_rules")
            .update({
              base_labor_rate: rule.base_labor_rate,
              material_rate: rule.material_rate,
              waste_factor: rule.waste_factor,
              overhead_multiplier: rule.overhead_multiplier,
              profit_margin: rule.profit_margin,
              notes: rule.notes,
            })
            .eq("id", rule.id);

          if (error) throw error;
        } else {
          // Insert new rule
          const { error } = await supabase
            .from("pricing_rules")
            .insert({
              user_id: user.id,
              account_id: currentAccount.id,
              service_type: serviceType,
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

      setIsDirty(false);
      toast.success("Pricing rules saved");
      await refreshProfile();
      fetchRules();
    } catch (error) {
      console.error("Error saving rules:", error);
      toast.error("Failed to save pricing rules");
    } finally {
      setSaving(false);
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
      } as PricingRule,
    }));
    setIsDirty(true);
    toast.success("Reset to defaults - save to apply");
  };

  const currentRule = rules[activeTab];
  const isLinearFeet = currentRule?.unit_type === "linear_ft";

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Pricing Rules"
        showBack
        backTo="/settings"
      />

      <main className="px-4 py-4">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
            {/* Info Card */}
            <div className="card-elevated rounded-lg p-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">How Quick Estimates Work</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set your labor and material rates per unit. Quick Estimate will automatically 
                  calculate ranges including waste, overhead, and profit margin.
                </p>
              </div>
            </div>

            {/* Tax Rate */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Default Tax Rate</h3>
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
                    onChange={(e) => {
                      setTaxRate(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Default Profit Margin</h3>
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
                    onChange={(e) => {
                      setProfitMargin(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Default Surcharge */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Default Surcharge</h3>
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
                    onChange={(e) => {
                      setSurcharge(e.target.value);
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
                <Button type="button" variant="outline" size="sm" onClick={startCreateTemplate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Template
                </Button>
              </div>

              {(editingTemplateId !== null || templateDraft.name || templateDraft.description) && (
                <div className="rounded-lg border border-border p-3 space-y-3 bg-background">
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
                    <Button type="button" size="sm" onClick={saveTemplateDraft}>
                      <Save className="h-4 w-4 mr-1" />
                      {editingTemplateId ? "Update Template" : "Save Template"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={resetTemplateDraft}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {lineItemTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              ) : (
                <div className="space-y-2">
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

            {/* Service Type Picker */}
            <div className="card-elevated rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pricing-service-type">Service Type</Label>
                <Select value={activeTab} onValueChange={(value) => setActiveTab(value as ServiceType)}>
                  <SelectTrigger id="pricing-service-type" className="mt-1.5">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingServiceTypes.map((service) => (
                      <SelectItem key={service} value={service}>
                        {SERVICE_LABELS[service]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentRule && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{SERVICE_LABELS[activeTab]}</h3>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => resetToDefaults(activeTab)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="labor-rate">
                        Labor Rate (per {isLinearFeet ? "linear ft" : "sq ft"})
                      </Label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="labor-rate"
                          type="number"
                          step="0.01"
                          value={currentRule.base_labor_rate}
                          onChange={(e) => updateRule(activeTab, "base_labor_rate", parseFloat(e.target.value) || 0)}
                          className="pl-7"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="material-rate">
                        Material Rate (per {isLinearFeet ? "linear ft" : "sq ft"})
                      </Label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="material-rate"
                          type="number"
                          step="0.01"
                          value={currentRule.material_rate}
                          onChange={(e) => updateRule(activeTab, "material_rate", parseFloat(e.target.value) || 0)}
                          className="pl-7"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="waste-factor">Waste Factor (%)</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="waste-factor"
                          type="number"
                          step="1"
                          value={currentRule.waste_factor}
                          onChange={(e) => updateRule(activeTab, "waste_factor", parseFloat(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="overhead">Overhead Multiplier</Label>
                      <Input
                        id="overhead"
                        type="number"
                        step="0.01"
                        value={currentRule.overhead_multiplier}
                        onChange={(e) => updateRule(activeTab, "overhead_multiplier", parseFloat(e.target.value) || 1)}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        1.15 = 15% overhead
                      </p>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="profit-margin">Profit Margin (%)</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="profit-margin"
                          type="number"
                          step="1"
                          value={currentRule.profit_margin}
                          onChange={(e) => updateRule(activeTab, "profit_margin", parseFloat(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Example Calculation */}
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-medium mb-2">Example: 100 {isLinearFeet ? "linear ft" : "sq ft"}</p>
                    <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-sm">
                      {(() => {
                        const qty = 100;
                        const labor = qty * currentRule.base_labor_rate;
                        const material = qty * currentRule.material_rate * (1 + currentRule.waste_factor / 100);
                        const subtotal = (labor + material) * currentRule.overhead_multiplier;
                        const total = subtotal * (1 + currentRule.profit_margin / 100);
                        const low = total * 0.9;
                        const high = total * 1.15;
                        
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Labor</span>
                              <span>${labor.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Materials (+ {currentRule.waste_factor}% waste)</span>
                              <span>${material.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">+ Overhead ({((currentRule.overhead_multiplier - 1) * 100).toFixed(0)}%)</span>
                              <span>${((labor + material) * (currentRule.overhead_multiplier - 1)).toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">+ Profit ({currentRule.profit_margin}%)</span>
                              <span>${(subtotal * currentRule.profit_margin / 100).toFixed(0)}</span>
                            </div>
                            <div className="border-t border-border pt-2 mt-2 flex justify-between font-medium">
                              <span>Estimate Range</span>
                              <span className="text-primary">${low.toFixed(0)} – ${high.toFixed(0)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Notes */}
                  {currentRule.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {currentRule.notes}
                    </p>
                  )}
                </>
              )}
            </div>
            </div>
          )}
        </div>

        <StickyActionBar onSave={saveRules} isSaving={saving} contentClassName="mx-auto max-w-4xl" />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}
