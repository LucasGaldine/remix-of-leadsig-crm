import type { ParsedCSV } from "@/lib/csvParser";

export type LineItemTemplateFieldKey =
  | "name"
  | "description"
  | "quantity"
  | "unit"
  | "unit_price"
  | "category";

export type LineItemTemplateColumnMapping = Record<string, LineItemTemplateFieldKey | "">;

export const LINE_ITEM_TEMPLATE_FIELDS: { key: LineItemTemplateFieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Title", required: true },
  { key: "description", label: "Description" },
  { key: "quantity", label: "Quantity" },
  { key: "unit", label: "Unit" },
  { key: "unit_price", label: "Unit Price" },
  { key: "category", label: "Category" },
];

const FIELD_ALIASES: Record<LineItemTemplateFieldKey, string[]> = {
  name: ["name", "title", "item", "line item", "template", "template name"],
  description: ["description", "details", "notes", "note"],
  quantity: ["qty", "quantity", "amount", "count"],
  unit: ["unit", "uom", "measure", "unit of measure"],
  unit_price: ["unit price", "price", "cost", "rate", "unit_cost", "unit cost"],
  category: ["category", "type", "group"],
};

const VALID_CATEGORIES = new Set(["equipment", "materials", "labor", "other"]);

export function autoMapLineItemTemplateColumns(headers: string[]): LineItemTemplateColumnMapping {
  const mapping: LineItemTemplateColumnMapping = {};
  const usedFields = new Set<LineItemTemplateFieldKey>();

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    let mapped: LineItemTemplateFieldKey | "" = "";

    for (const field of LINE_ITEM_TEMPLATE_FIELDS) {
      const aliases = FIELD_ALIASES[field.key];
      if (aliases.includes(normalizedHeader) && !usedFields.has(field.key)) {
        mapped = field.key;
        usedFields.add(field.key);
        break;
      }
    }

    mapping[header] = mapped;
  }

  return mapping;
}

export function buildLineItemTemplatePayloadFromRow(
  headers: string[],
  row: string[],
  mapping: LineItemTemplateColumnMapping,
): {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
} | null {
  const fieldToHeaderIndices: Partial<Record<LineItemTemplateFieldKey, number[]>> = {};

  headers.forEach((header, index) => {
    const field = mapping[header];
    if (!field) return;
    if (!fieldToHeaderIndices[field]) fieldToHeaderIndices[field] = [];
    fieldToHeaderIndices[field]!.push(index);
  });

  const getValue = (field: LineItemTemplateFieldKey) => {
    const indices = fieldToHeaderIndices[field];
    if (!indices || indices.length === 0) return "";
    const parts = indices.map((idx) => row[idx]?.trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "";
  };

  const name = getValue("name").trim();
  if (!name) return null;

  const quantityValue = parseNumericString(getValue("quantity"), "1");
  const priceValue = parseNumericString(getValue("unit_price"), "0");
  const rawCategory = getValue("category").trim().toLowerCase();

  return {
    name,
    description: getValue("description"),
    quantity: quantityValue,
    unit: getValue("unit") || "each",
    unit_price: priceValue,
    category: VALID_CATEGORIES.has(rawCategory) ? rawCategory : "other",
  };
}

export function getLineItemTemplateCombineInfo(
  mapping: LineItemTemplateColumnMapping,
  headers: string[],
) {
  const fieldToHeaders: Partial<Record<LineItemTemplateFieldKey, string[]>> = {};
  for (const header of headers) {
    const field = mapping[header];
    if (!field) continue;
    if (!fieldToHeaders[field]) fieldToHeaders[field] = [];
    fieldToHeaders[field]!.push(header);
  }
  return fieldToHeaders;
}

export function parseLineItemTemplateCsv(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function parseNumericString(value: string, fallback: string) {
  if (!value.trim()) return fallback;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
