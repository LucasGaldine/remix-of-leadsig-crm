import { supabase } from "@/integrations/supabase/client";
import { isMissingRelationError, type SupabaseLikeError } from "@/lib/supabaseErrors";

type EstimateVersionLineItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order?: number;
  category?: "equipment" | "materials" | "labor" | "other";
};

interface CreateEstimateVersionSnapshotInput {
  estimateId: string;
  accountId: string;
  name: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  profitMargin?: number;
  surcharge?: number;
  notes?: string | null;
  lineItems: EstimateVersionLineItem[];
}

export function isEstimateVersionsUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const typedError = error as SupabaseLikeError & { status?: number; details?: string | null; hint?: string | null };
  if (isMissingRelationError(typedError, "estimate_versions")) {
    return true;
  }

  const status = typeof typedError.status === "number" ? typedError.status : null;
  const details = [typedError.message, typedError.details, typedError.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return status === 404 && details.includes("estimate_versions");
}

export async function createEstimateVersionSnapshot({
  estimateId,
  accountId,
  name,
  subtotal,
  taxRate,
  tax,
  discount,
  total,
  profitMargin = 0,
  surcharge = 0,
  notes = null,
  lineItems,
}: CreateEstimateVersionSnapshotInput): Promise<{ created: boolean; unavailable: boolean }> {
  const { error } = await supabase.from("estimate_versions").insert({
    estimate_id: estimateId,
    account_id: accountId,
    name,
    subtotal,
    tax_rate: taxRate,
    tax,
    discount,
    total,
    profit_margin: profitMargin,
    surcharge,
    notes,
    line_items: lineItems,
  });

  if (!error) {
    return { created: true, unavailable: false };
  }

  if (isEstimateVersionsUnavailableError(error)) {
    return { created: false, unavailable: true };
  }

  throw error;
}
