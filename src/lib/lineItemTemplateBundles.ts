import type { LineItemTemplate } from "@/lib/lineItemTemplates";

export interface ExpandedBundleLineItem {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
}

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  const rounded = Number(value.toFixed(4));
  return rounded.toString();
}

export function expandBundleTemplate(
  bundle: LineItemTemplate,
  templates: LineItemTemplate[],
  bundleUnitsRaw: string,
): ExpandedBundleLineItem[] {
  if (bundle.template_type !== "bundle") return [];

  const bundleUnits = toNumber(bundleUnitsRaw, 1);
  if (bundleUnits <= 0) return [];

  const templatesById = new Map(
    templates
      .filter((template) => template.template_type !== "bundle")
      .map((template) => [template.id, template] as const),
  );

  return bundle.bundle_items.flatMap((item) => {
    const connectedTemplate = templatesById.get(item.template_id);
    if (!connectedTemplate) return [];

    const templateQuantity = toNumber(connectedTemplate.quantity, 1);
    const quantityPerUnit = toNumber(item.quantity_per_unit, 0);
    const finalQuantity = templateQuantity * quantityPerUnit * bundleUnits;
    if (finalQuantity <= 0) return [];

    return [{
      name: connectedTemplate.name,
      description: connectedTemplate.description || "",
      quantity: normalizeQuantity(finalQuantity),
      unit: connectedTemplate.unit || "each",
      unit_price: connectedTemplate.unit_price || "0",
      category: connectedTemplate.category || "other",
    }];
  });
}
