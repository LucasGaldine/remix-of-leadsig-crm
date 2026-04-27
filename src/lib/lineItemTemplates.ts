import { supabase } from "@/integrations/supabase/client";

export interface LineItemBundleItem {
  template_id: string;
  quantity_per_unit: string;
}

export interface LineItemTemplate {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
  template_type: "template" | "bundle";
  bundle_items: LineItemBundleItem[];
  created_at: string;
}

interface TemplatePayload {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
  template_type?: "template" | "bundle";
  bundle_items?: LineItemBundleItem[];
}

interface GetLineItemTemplatesOptions {
  includeBundles?: boolean;
}

const GLOBAL_LEGACY_KEY = "leadsig_line_item_templates_global";
const ACCOUNT_LEGACY_PREFIX = "leadsig_line_item_templates_";
const BASE_TEMPLATE_SELECT = "id, name, description, quantity, unit, unit_price, category, created_at";
const BUNDLE_TEMPLATE_SELECT = `${BASE_TEMPLATE_SELECT}, template_type, bundle_items`;
let supportsBundleColumns: boolean | null = null;

function isMissingBundleColumnsError(error: any) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "42703" || code === "PGRST204" || message.includes("template_type") || message.includes("bundle_items");
}

function toLegacyInsertPayload(accountId: string, payload: TemplatePayload) {
  return {
    account_id: accountId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    quantity: Number(payload.quantity || 1),
    unit: payload.unit || "each",
    unit_price: Number(payload.unit_price || 0),
    category: payload.category || "other",
  };
}

function toTemplate(row: any): LineItemTemplate {
  const parsedBundleItems = Array.isArray(row.bundle_items)
    ? row.bundle_items
      .map((item: any) => {
        const templateId = String(item?.template_id || "").trim();
        if (!templateId) return null;

        return {
          template_id: templateId,
          quantity_per_unit: String(item?.quantity_per_unit ?? "1"),
        } as LineItemBundleItem;
      })
      .filter((item): item is LineItemBundleItem => Boolean(item))
    : [];

  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    quantity: String(row.quantity ?? "1"),
    unit: String(row.unit || "each"),
    unit_price: String(row.unit_price ?? "0"),
    category: String(row.category || "other"),
    template_type: row.template_type === "bundle" ? "bundle" : "template",
    bundle_items: parsedBundleItems,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function toInsertPayload(accountId: string, payload: TemplatePayload) {
  const templateType = payload.template_type || "template";

  return {
    account_id: accountId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    quantity: Number(payload.quantity || 1),
    unit: payload.unit || "each",
    unit_price: Number(payload.unit_price || 0),
    category: payload.category || "other",
    template_type: templateType,
    bundle_items: templateType === "bundle"
      ? (payload.bundle_items || []).map((item) => ({
        template_id: item.template_id,
        quantity_per_unit: Number(item.quantity_per_unit || 0),
      }))
      : null,
  };
}

function parseLegacyTemplates(raw: string | null): LineItemTemplate[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any) => {
        const name = String(item?.name || "").trim();
        if (!name) return null;

        return {
          id: String(item?.id || crypto.randomUUID()),
          name,
          description: String(item?.description || ""),
          quantity: String(item?.quantity || "1"),
          unit: String(item?.unit || "each"),
          unit_price: String(item?.unit_price || "0"),
          category: String(item?.category || "other"),
          template_type: "template",
          bundle_items: [],
          created_at: String(item?.created_at || new Date().toISOString()),
        } as LineItemTemplate;
      })
      .filter((item): item is LineItemTemplate => Boolean(item))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

function buildFingerprint(template: TemplatePayload) {
  return [
    template.name.trim().toLowerCase(),
    template.description.trim().toLowerCase(),
    (template.unit || "").trim().toLowerCase(),
    (parseFloat(template.unit_price || "0") || 0).toFixed(2),
    (template.category || "other").trim().toLowerCase(),
    template.template_type || "template",
    JSON.stringify(
      (template.bundle_items || [])
        .map((item) => ({
          template_id: item.template_id,
          quantity_per_unit: (parseFloat(item.quantity_per_unit || "0") || 0).toFixed(4),
        }))
        .sort((a, b) => a.template_id.localeCompare(b.template_id)),
    ),
  ].join("|");
}

export async function getLineItemTemplates(
  accountId: string,
  options: GetLineItemTemplatesOptions = {},
): Promise<LineItemTemplate[]> {
  if (!accountId) return [];

  try {
    const shouldUseBundleColumns = supportsBundleColumns !== false;
    let query = (supabase as any)
      .from("line_item_templates")
      .select(shouldUseBundleColumns ? BUNDLE_TEMPLATE_SELECT : BASE_TEMPLATE_SELECT)
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (!options.includeBundles && shouldUseBundleColumns) {
      query = query.eq("template_type", "template");
    }

    const { data, error } = await query;

    if (error) throw error;
    if (shouldUseBundleColumns) supportsBundleColumns = true;
    return (data || []).map(toTemplate);
  } catch (error) {
    if (isMissingBundleColumnsError(error)) {
      supportsBundleColumns = false;
      try {
        const { data, error: legacyError } = await (supabase as any)
          .from("line_item_templates")
          .select(BASE_TEMPLATE_SELECT)
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });

        if (legacyError) throw legacyError;
        return (data || []).map(toTemplate);
      } catch (legacyFetchError) {
        console.error("Failed to fetch line item templates (legacy fallback)", legacyFetchError);
        return [];
      }
    }

    console.error("Failed to fetch line item templates", error);
    return [];
  }
}

export async function createLineItemTemplate(accountId: string, payload: TemplatePayload): Promise<LineItemTemplate | null> {
  if (!accountId || !payload.name.trim()) return null;

  try {
    const shouldUseBundleColumns = supportsBundleColumns !== false;
    if (!shouldUseBundleColumns && payload.template_type === "bundle") {
      console.error("Bundle templates require the bundle migration to be applied");
      return null;
    }

    const { data, error } = await (supabase as any)
      .from("line_item_templates")
      .insert(shouldUseBundleColumns ? toInsertPayload(accountId, payload) : toLegacyInsertPayload(accountId, payload))
      .select(shouldUseBundleColumns ? BUNDLE_TEMPLATE_SELECT : BASE_TEMPLATE_SELECT)
      .single();

    if (error) throw error;
    if (shouldUseBundleColumns) supportsBundleColumns = true;
    return data ? toTemplate(data) : null;
  } catch (error) {
    if (isMissingBundleColumnsError(error)) {
      supportsBundleColumns = false;
      if (payload.template_type === "bundle") {
        console.error("Bundle templates require the bundle migration to be applied", error);
        return null;
      }

      try {
        const { data, error: legacyError } = await (supabase as any)
          .from("line_item_templates")
          .insert(toLegacyInsertPayload(accountId, payload))
          .select(BASE_TEMPLATE_SELECT)
          .single();

        if (legacyError) throw legacyError;
        return data ? toTemplate(data) : null;
      } catch (legacyCreateError) {
        console.error("Failed to create line item template (legacy fallback)", legacyCreateError);
        return null;
      }
    }

    console.error("Failed to create line item template", error);
    return null;
  }
}

export async function updateLineItemTemplate(templateId: string, payload: TemplatePayload): Promise<LineItemTemplate | null> {
  if (!templateId || !payload.name.trim()) return null;

  const templateType = payload.template_type || "template";

  try {
    const shouldUseBundleColumns = supportsBundleColumns !== false;
    if (!shouldUseBundleColumns && templateType === "bundle") {
      console.error("Bundle templates require the bundle migration to be applied");
      return null;
    }

    const { data, error } = await (supabase as any)
      .from("line_item_templates")
      .update(
        shouldUseBundleColumns
          ? {
            name: payload.name.trim(),
            description: payload.description?.trim() || null,
            quantity: Number(payload.quantity || 1),
            unit: payload.unit || "each",
            unit_price: Number(payload.unit_price || 0),
            category: payload.category || "other",
            template_type: templateType,
            bundle_items: templateType === "bundle"
              ? (payload.bundle_items || []).map((item) => ({
                template_id: item.template_id,
                quantity_per_unit: Number(item.quantity_per_unit || 0),
              }))
              : null,
          }
          : {
            name: payload.name.trim(),
            description: payload.description?.trim() || null,
            quantity: Number(payload.quantity || 1),
            unit: payload.unit || "each",
            unit_price: Number(payload.unit_price || 0),
            category: payload.category || "other",
          },
      )
      .eq("id", templateId)
      .select(shouldUseBundleColumns ? BUNDLE_TEMPLATE_SELECT : BASE_TEMPLATE_SELECT)
      .single();

    if (error) throw error;
    if (shouldUseBundleColumns) supportsBundleColumns = true;
    return data ? toTemplate(data) : null;
  } catch (error) {
    if (isMissingBundleColumnsError(error)) {
      supportsBundleColumns = false;
      if (templateType === "bundle") {
        console.error("Bundle templates require the bundle migration to be applied", error);
        return null;
      }

      try {
        const { data, error: legacyError } = await (supabase as any)
          .from("line_item_templates")
          .update({
            name: payload.name.trim(),
            description: payload.description?.trim() || null,
            quantity: Number(payload.quantity || 1),
            unit: payload.unit || "each",
            unit_price: Number(payload.unit_price || 0),
            category: payload.category || "other",
          })
          .eq("id", templateId)
          .select(BASE_TEMPLATE_SELECT)
          .single();

        if (legacyError) throw legacyError;
        return data ? toTemplate(data) : null;
      } catch (legacyUpdateError) {
        console.error("Failed to update line item template (legacy fallback)", legacyUpdateError);
        return null;
      }
    }

    console.error("Failed to update line item template", error);
    return null;
  }
}

export async function deleteLineItemTemplate(templateId: string): Promise<boolean> {
  if (!templateId) return false;

  try {
    const { error } = await (supabase as any)
      .from("line_item_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to delete line item template", error);
    return false;
  }
}

export async function upsertDedupedLineItemTemplate(
  accountId: string,
  payload: TemplatePayload,
  existingTemplates: LineItemTemplate[],
): Promise<LineItemTemplate | null> {
  const match = existingTemplates.find((template) =>
    buildFingerprint({
      name: template.name,
      description: template.description,
      quantity: template.quantity,
      unit: template.unit,
      unit_price: template.unit_price,
      category: template.category,
      template_type: template.template_type,
      bundle_items: template.bundle_items,
    }) === buildFingerprint(payload),
  );

  if (match) {
    return updateLineItemTemplate(match.id, payload);
  }

  return createLineItemTemplate(accountId, payload);
}

export async function migrateLegacyTemplatesToDatabase(accountId: string) {
  if (!accountId) return;

  try {
    const { count, error: countError } = await (supabase as any)
      .from("line_item_templates")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);

    if (countError) throw countError;
    if ((count || 0) > 0) return;

    const globalLegacyTemplates = parseLegacyTemplates(window.localStorage.getItem(GLOBAL_LEGACY_KEY));
    const accountLegacyTemplates = parseLegacyTemplates(
      window.localStorage.getItem(`${ACCOUNT_LEGACY_PREFIX}${accountId}`),
    );

    const merged = [...globalLegacyTemplates, ...accountLegacyTemplates];
    if (merged.length === 0) return;

    const uniqueByFingerprint = new Map<string, LineItemTemplate>();
    for (const template of merged) {
      const key = buildFingerprint({
        name: template.name,
        description: template.description,
        quantity: template.quantity,
        unit: template.unit,
        unit_price: template.unit_price,
        category: template.category,
        template_type: template.template_type,
        bundle_items: template.bundle_items,
      });
      if (!uniqueByFingerprint.has(key)) {
        uniqueByFingerprint.set(key, template);
      }
    }

    const templates = Array.from(uniqueByFingerprint.values());
    const modernPayload = templates.map((template) =>
      toInsertPayload(accountId, {
        name: template.name,
        description: template.description,
        quantity: template.quantity,
        unit: template.unit,
        unit_price: template.unit_price,
        category: template.category,
        template_type: template.template_type,
        bundle_items: template.bundle_items,
      }),
    );

    if (supportsBundleColumns !== false) {
      const { error: insertError } = await (supabase as any)
        .from("line_item_templates")
        .insert(modernPayload);

      if (!insertError) {
        supportsBundleColumns = true;
        return;
      }

      if (!isMissingBundleColumnsError(insertError)) {
        throw insertError;
      }

      supportsBundleColumns = false;
    }

    const legacyPayload = templates.map((template) =>
      toLegacyInsertPayload(accountId, {
        name: template.name,
        description: template.description,
        quantity: template.quantity,
        unit: template.unit,
        unit_price: template.unit_price,
        category: template.category,
        template_type: template.template_type,
        bundle_items: template.bundle_items,
      }),
    );

    const { error: legacyInsertError } = await (supabase as any)
      .from("line_item_templates")
      .insert(legacyPayload);

    if (legacyInsertError) throw legacyInsertError;
  } catch (error) {
    console.error("Failed migrating legacy line item templates", error);
  }
}
