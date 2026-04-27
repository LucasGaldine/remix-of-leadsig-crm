import { describe, expect, it } from "vitest";
import { expandBundleTemplate } from "@/lib/lineItemTemplateBundles";
import type { LineItemTemplate } from "@/lib/lineItemTemplates";

function buildTemplate(overrides: Partial<LineItemTemplate>): LineItemTemplate {
  return {
    id: overrides.id || "template-id",
    name: overrides.name || "Template",
    description: overrides.description || "",
    quantity: overrides.quantity || "1",
    unit: overrides.unit || "each",
    unit_price: overrides.unit_price || "0",
    category: overrides.category || "other",
    template_type: overrides.template_type || "template",
    bundle_items: overrides.bundle_items || [],
    created_at: overrides.created_at || new Date().toISOString(),
  };
}

describe("expandBundleTemplate", () => {
  it("expands bundle units into connected template quantities", () => {
    const mulch = buildTemplate({
      id: "t-1",
      name: "Mulch",
      quantity: "2",
      unit: "sq ft",
      unit_price: "5",
      category: "materials",
    });
    const edging = buildTemplate({
      id: "t-2",
      name: "Edging",
      quantity: "1",
      unit: "linear ft",
      unit_price: "4",
      category: "materials",
    });
    const bundle = buildTemplate({
      id: "b-1",
      name: "Front Yard Package",
      template_type: "bundle",
      bundle_items: [
        { template_id: "t-1", quantity_per_unit: "3" },
        { template_id: "t-2", quantity_per_unit: "2" },
      ],
    });

    const result = expandBundleTemplate(bundle, [mulch, edging, bundle], "2");

    expect(result).toEqual([
      {
        name: "Mulch",
        description: "",
        quantity: "12",
        unit: "sq ft",
        unit_price: "5",
        category: "materials",
      },
      {
        name: "Edging",
        description: "",
        quantity: "4",
        unit: "linear ft",
        unit_price: "4",
        category: "materials",
      },
    ]);
  });

  it("skips missing connected templates", () => {
    const bundle = buildTemplate({
      id: "b-1",
      name: "Package",
      template_type: "bundle",
      bundle_items: [{ template_id: "missing", quantity_per_unit: "1" }],
    });

    const result = expandBundleTemplate(bundle, [], "1");

    expect(result).toEqual([]);
  });

  it("returns empty list for non-bundles", () => {
    const template = buildTemplate({ id: "t-1", template_type: "template" });

    const result = expandBundleTemplate(template, [template], "1");

    expect(result).toEqual([]);
  });
});
