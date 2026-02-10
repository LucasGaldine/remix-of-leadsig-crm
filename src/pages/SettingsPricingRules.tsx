import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, RotateCcw, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  DEFAULT_PRICING_RULES, 
  SERVICE_LABELS, 
  ServiceType 
} from "@/hooks/useQuickEstimate";

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
  const navigate = useNavigate();
  const { user, currentAccount, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);
  const [rules, setRules] = useState<Record<ServiceType, PricingRule>>({} as Record<ServiceType, PricingRule>);
  const [activeTab, setActiveTab] = useState<ServiceType>("pavers");
  const [taxRate, setTaxRate] = useState<string>("");

  useEffect(() => {
    fetchRules();
    if (currentAccount) {
      setTaxRate(String(currentAccount.default_tax_rate ?? 8));
    }
  }, [user?.id, currentAccount?.id]);

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
    
    (Object.keys(DEFAULT_PRICING_RULES) as ServiceType[]).forEach((serviceType) => {
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
      const { error: taxError } = await supabase
        .from("accounts")
        .update({ default_tax_rate: parsedTax })
        .eq("id", currentAccount.id);

      if (taxError) throw taxError;

      for (const serviceType of Object.keys(rules) as ServiceType[]) {
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
  const isFencing = activeTab === "fencing";

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Pricing Rules"
        showBack
        backTo="/settings"
      />

      <main className="px-4 py-4">
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

            {/* Service Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ServiceType)}>
              <TabsList className="w-full grid grid-cols-5 h-auto">
                {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((service) => (
                  <TabsTrigger 
                    key={service} 
                    value={service}
                    className="text-xs px-2 py-2"
                  >
                    {service === "pavers" ? "Pavers" :
                     service === "concrete" ? "Concrete" :
                     service === "sod" ? "Sod" :
                     service === "deck" ? "Deck" : "Fence"}
                  </TabsTrigger>
                ))}
              </TabsList>

              {currentRule && (
                <TabsContent value={activeTab} className="mt-4">
                  <div className="card-elevated rounded-lg p-4 space-y-4">
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
                          Labor Rate (per {isFencing ? "linear ft" : "sq ft"})
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
                          Material Rate (per {isFencing ? "linear ft" : "sq ft"})
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
                      <p className="text-sm font-medium mb-2">Example: 100 {isFencing ? "linear ft" : "sq ft"}</p>
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
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}

        <StickyActionBar onSave={saveRules} isSaving={saving} />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}
