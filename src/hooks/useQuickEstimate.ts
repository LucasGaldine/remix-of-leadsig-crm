import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ServiceType = "pavers" | "concrete" | "sod" | "deck" | "fencing";

export interface PricingRule {
  id: string;
  user_id: string;
  service_type: string;
  base_labor_rate: number;
  material_rate: number;
  waste_factor: number;
  overhead_multiplier: number;
  profit_margin: number;
  unit_type: string;
  notes?: string;
}

export interface Measurements {
  sqft?: number;
  linearFeet?: number;
  depth?: number;
  height?: number;
}

export interface QuickEstimateResult {
  laborTotal: number;
  materialTotal: number;
  totalLow: number;
  totalMid: number;
  totalHigh: number;
}

// Default pricing rules for landscaping services
export const DEFAULT_PRICING_RULES: Record<ServiceType, Omit<PricingRule, 'id' | 'user_id'>> = {
  pavers: {
    service_type: "pavers",
    base_labor_rate: 8,
    material_rate: 6,
    waste_factor: 10,
    overhead_multiplier: 1.15,
    profit_margin: 20,
    unit_type: "sq_ft",
    notes: "Per sq ft - includes base prep, sand, and paver installation",
  },
  concrete: {
    service_type: "concrete",
    base_labor_rate: 6,
    material_rate: 4,
    waste_factor: 5,
    overhead_multiplier: 1.15,
    profit_margin: 20,
    unit_type: "sq_ft",
    notes: "Per sq ft - standard 4\" slab with wire mesh",
  },
  sod: {
    service_type: "sod",
    base_labor_rate: 1.5,
    material_rate: 0.75,
    waste_factor: 10,
    overhead_multiplier: 1.10,
    profit_margin: 25,
    unit_type: "sq_ft",
    notes: "Per sq ft - includes soil prep and installation",
  },
  deck: {
    service_type: "deck",
    base_labor_rate: 25,
    material_rate: 15,
    waste_factor: 10,
    overhead_multiplier: 1.20,
    profit_margin: 25,
    unit_type: "sq_ft",
    notes: "Per sq ft - pressure treated wood, standard construction",
  },
  fencing: {
    service_type: "fencing",
    base_labor_rate: 18,
    material_rate: 12,
    waste_factor: 5,
    overhead_multiplier: 1.15,
    profit_margin: 20,
    unit_type: "linear_ft",
    notes: "Per linear ft - 6ft wood privacy fence",
  },
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  pavers: "Pavers / Patio",
  concrete: "Concrete",
  sod: "Sod / Lawn",
  deck: "Deck",
  fencing: "Fencing",
};

export function useQuickEstimate(leadId: string) {
  const { user } = useAuth();
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch user's pricing rules
  const fetchPricingRules = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching pricing rules:", error);
      return;
    }

    // If no rules exist, create defaults
    if (!data || data.length === 0) {
      await createDefaultRules();
    } else {
      setPricingRules(data as PricingRule[]);
    }
    setLoading(false);
  }, [user?.id]);

  // Create default pricing rules for new users
  const createDefaultRules = async () => {
    if (!user?.id) return;

    const defaultRules = Object.values(DEFAULT_PRICING_RULES).map((rule) => ({
      ...rule,
      user_id: user.id,
    }));

    const { data, error } = await supabase
      .from("pricing_rules")
      .insert(defaultRules)
      .select();

    if (error) {
      console.error("Error creating default rules:", error);
      toast.error("Failed to initialize pricing rules");
      return;
    }

    setPricingRules(data as PricingRule[]);
  };

  useEffect(() => {
    fetchPricingRules();
  }, [fetchPricingRules]);

  // Get pricing rule for a service type
  const getPricingRule = useCallback(
    (serviceType: ServiceType): PricingRule | undefined => {
      return pricingRules.find((rule) => rule.service_type === serviceType);
    },
    [pricingRules]
  );

  // Calculate estimate based on measurements
  const calculateEstimate = useCallback(
    (serviceType: ServiceType, measurements: Measurements): QuickEstimateResult => {
      const rule = getPricingRule(serviceType);
      
      if (!rule) {
        const defaultRule = DEFAULT_PRICING_RULES[serviceType];
        return calculateWithRule(defaultRule as PricingRule, measurements);
      }

      return calculateWithRule(rule, measurements);
    },
    [getPricingRule]
  );

  // Core calculation logic
  const calculateWithRule = (rule: PricingRule, measurements: Measurements): QuickEstimateResult => {
    const quantity = rule.unit_type === "linear_ft" 
      ? (measurements.linearFeet || 0)
      : (measurements.sqft || 0);

    if (quantity === 0) {
      return { laborTotal: 0, materialTotal: 0, totalLow: 0, totalMid: 0, totalHigh: 0 };
    }

    // Base calculations
    const laborBase = quantity * rule.base_labor_rate;
    const materialBase = quantity * rule.material_rate;
    
    // Add waste factor to materials
    const materialWithWaste = materialBase * (1 + rule.waste_factor / 100);
    
    // Apply overhead multiplier
    const subtotal = (laborBase + materialWithWaste) * rule.overhead_multiplier;
    
    // Calculate with profit margin to get mid estimate
    const totalMid = subtotal * (1 + rule.profit_margin / 100);
    
    // Calculate range: low is -10%, high is +15%
    const totalLow = totalMid * 0.9;
    const totalHigh = totalMid * 1.15;

    return {
      laborTotal: Math.round(laborBase),
      materialTotal: Math.round(materialWithWaste),
      totalLow: Math.round(totalLow),
      totalMid: Math.round(totalMid),
      totalHigh: Math.round(totalHigh),
    };
  };

  // Save quick estimate to database
  const saveQuickEstimate = async (
    serviceType: ServiceType,
    measurements: Measurements,
    result: QuickEstimateResult,
    notes?: string
  ) => {
    if (!user?.id || !leadId) return null;

    setSaving(true);

    try {
      // Save quick estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("quick_estimates")
        .insert([{
          lead_id: leadId,
          created_by: user.id,
          service_type: serviceType,
          measurements: JSON.parse(JSON.stringify(measurements)),
          labor_total: result.laborTotal,
          material_total: result.materialTotal,
          total_low: result.totalLow,
          total_mid: result.totalMid,
          total_high: result.totalHigh,
          notes,
        }])
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Log interaction
      await supabase.from("interactions").insert({
        lead_id: leadId,
        type: "note",
        direction: "na",
        summary: "Quick estimate created",
        body: `${SERVICE_LABELS[serviceType]}: $${result.totalLow.toLocaleString()} - $${result.totalHigh.toLocaleString()} (${measurements.sqft || measurements.linearFeet} ${serviceType === 'fencing' ? 'linear ft' : 'sq ft'})`,
        created_by: user.id,
      });

      toast.success("Estimate saved");
      return estimate;
    } catch (error) {
      console.error("Error saving estimate:", error);
      toast.error("Failed to save estimate");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    pricingRules,
    loading,
    saving,
    calculateEstimate,
    saveQuickEstimate,
    getPricingRule,
    refetchRules: fetchPricingRules,
  };
}
