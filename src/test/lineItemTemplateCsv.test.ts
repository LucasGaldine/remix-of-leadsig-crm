import { describe, expect, it } from "vitest";

import {
  autoMapLineItemTemplateColumns,
  buildLineItemTemplatePayloadFromRow,
  type LineItemTemplateColumnMapping,
} from "@/lib/lineItemTemplateCsv";

describe("lineItemTemplateCsv", () => {
  it("auto maps common CSV headers", () => {
    const mapping = autoMapLineItemTemplateColumns([
      "Item",
      "Qty",
      "Unit Price",
      "Category",
      "Description",
      "UOM",
    ]);

    expect(mapping.Item).toBe("name");
    expect(mapping.Qty).toBe("quantity");
    expect(mapping["Unit Price"]).toBe("unit_price");
    expect(mapping.Category).toBe("category");
    expect(mapping.Description).toBe("description");
    expect(mapping.UOM).toBe("unit");
  });

  it("builds a normalized template payload from mapped row values", () => {
    const headers = ["Item", "Details", "Qty", "Unit", "Unit Price", "Category"];
    const row = ["Black Mulch", "Premium bark", "2", "yard", "$45.50", "Materials"];
    const mapping: LineItemTemplateColumnMapping = {
      Item: "name",
      Details: "description",
      Qty: "quantity",
      Unit: "unit",
      "Unit Price": "unit_price",
      Category: "category",
    };

    const payload = buildLineItemTemplatePayloadFromRow(headers, row, mapping);

    expect(payload).toEqual({
      name: "Black Mulch",
      description: "Premium bark",
      quantity: "2",
      unit: "yard",
      unit_price: "45.5",
      category: "materials",
    });
  });

  it("returns null when name is missing", () => {
    const headers = ["Title"];
    const row = [""];
    const mapping: LineItemTemplateColumnMapping = { Title: "name" };

    const payload = buildLineItemTemplatePayloadFromRow(headers, row, mapping);

    expect(payload).toBeNull();
  });
});
