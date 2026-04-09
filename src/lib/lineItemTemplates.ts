export interface LineItemTemplate {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
  created_at: string;
}

export const LINE_ITEM_TEMPLATE_STORAGE_KEY = "leadsig_line_item_templates_global";
const LEGACY_LINE_ITEM_TEMPLATE_STORAGE_PREFIX = "leadsig_line_item_templates_";

function sanitizeTemplate(raw: any): LineItemTemplate | null {
  const name = String(raw?.name || "").trim();
  if (!name) return null;

  return {
    id: String(raw?.id || crypto.randomUUID()),
    name,
    description: String(raw?.description || ""),
    quantity: String(raw?.quantity || "1"),
    unit: String(raw?.unit || "each"),
    unit_price: String(raw?.unit_price || "0"),
    category: String(raw?.category || "other"),
    created_at: String(raw?.created_at || new Date().toISOString()),
  };
}

export function parseLineItemTemplates(raw: string | null): LineItemTemplate[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => sanitizeTemplate(item))
      .filter((item): item is LineItemTemplate => Boolean(item))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function loadGlobalLineItemTemplates(legacyAccountId?: string | null): LineItemTemplate[] {
  const globalTemplates = parseLineItemTemplates(window.localStorage.getItem(LINE_ITEM_TEMPLATE_STORAGE_KEY));
  if (globalTemplates.length > 0) return globalTemplates;

  if (!legacyAccountId) return [];

  const legacyKey = `${LEGACY_LINE_ITEM_TEMPLATE_STORAGE_PREFIX}${legacyAccountId}`;
  const legacyTemplates = parseLineItemTemplates(window.localStorage.getItem(legacyKey));
  if (legacyTemplates.length > 0) {
    saveGlobalLineItemTemplates(legacyTemplates);
  }

  return legacyTemplates;
}

export function saveGlobalLineItemTemplates(templates: LineItemTemplate[]) {
  window.localStorage.setItem(LINE_ITEM_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}
