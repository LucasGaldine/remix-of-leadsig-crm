import { useEffect, useState } from "react";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_SERVICE_TYPE_LABELS: Record<string, string> = {
  pavers: "Pavers / Patio",
  concrete: "Concrete",
  sod: "Sod / Lawn",
  deck: "Deck",
  fencing: "Fencing",
  retaining_wall: "Retaining Wall",
  grading: "Grading",
  landscaping: "Landscaping",
  hardscaping: "Hardscaping",
  other: "Other",
};

export const formatServiceTypeOption = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  if (DEFAULT_SERVICE_TYPE_LABELS[normalized]) {
    return DEFAULT_SERVICE_TYPE_LABELS[normalized];
  }

  if (SERVICE_TYPES.includes(normalized as (typeof SERVICE_TYPES)[number])) {
    return normalized;
  }

  const looksLikeSlug = normalized.includes("_") || normalized.includes("-");
  if (looksLikeSlug) {
    return normalized
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return normalized;
};

export function useServiceTypeOptions(enabled = true) {
  const { currentAccount } = useAuth();
  const [options, setOptions] = useState<string[]>([...SERVICE_TYPES]);

  useEffect(() => {
    if (!enabled || !currentAccount?.id) return;
    let isCancelled = false;

    const loadServiceTypeOptions = async () => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("service_type")
        .eq("account_id", currentAccount.id);

      if (isCancelled) return;

      if (error || !data) {
        if (error) {
          console.error("Error loading service types:", error);
        }
        setOptions([...SERVICE_TYPES]);
        return;
      }

      const mapped = Array.from(
        new Set(
          data
            .map((rule) => String((rule as { service_type?: string }).service_type || "").trim())
            .filter(Boolean)
            .map((serviceTypeValue) => formatServiceTypeOption(serviceTypeValue)),
        ),
      );

      if (mapped.length === 0) {
        setOptions([...SERVICE_TYPES]);
        return;
      }

      const orderedDefaults = SERVICE_TYPES.filter((defaultType) => mapped.includes(defaultType));
      const customTypes = mapped.filter((type) => !SERVICE_TYPES.includes(type as (typeof SERVICE_TYPES)[number]));
      const ordered = [...orderedDefaults, ...customTypes];

      if (!ordered.includes("Other")) {
        ordered.push("Other");
      }

      setOptions(ordered);
    };

    void loadServiceTypeOptions();

    return () => {
      isCancelled = true;
    };
  }, [enabled, currentAccount?.id]);

  return options;
}
