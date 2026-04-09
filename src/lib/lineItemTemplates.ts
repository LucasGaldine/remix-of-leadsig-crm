import { supabase } from "@/integrations/supabase/client";

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

interface TemplatePayload {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  category: string;
}

const GLOBAL_LEGACY_KEY = "leadsig_line_item_templates_global";
const ACCOUNT_LEGACY_PREFIX = "leadsig_line_item_templates_";

function toTemplate(row: any): LineItemTemplate {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    quantity: String(row.quantity ?? "1"),
    unit: String(row.unit || "each"),
    unit_price: String(row.unit_price ?? "0"),
    category: String(row.category || "other"),
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function toInsertPayload(accountId: string, payload: TemplatePayload) {
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
  ].join("|");
}

export async function getLineItemTemplates(accountId: string): Promise<LineItemTemplate[]> {
  if (!accountId) return [];

  try {
    const { data, error } = await (supabase as any)
      .from("line_item_templates")
      .select("id, name, description, quantity, unit, unit_price, category, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(toTemplate);
  } catch (error) {
    console.error("Failed to fetch line item templates", error);
    return [];
  }
}

export async function createLineItemTemplate(accountId: string, payload: TemplatePayload): Promise<LineItemTemplate | null> {
  if (!accountId || !payload.name.trim()) return null;

  try {
    const { data, error } = await (supabase as any)
      .from("line_item_templates")
      .insert(toInsertPayload(accountId, payload))
      .select("id, name, description, quantity, unit, unit_price, category, created_at")
      .single();

    if (error) throw error;
    return data ? toTemplate(data) : null;
  } catch (error) {
    console.error("Failed to create line item template", error);
    return null;
  }
}

export async function updateLineItemTemplate(templateId: string, payload: TemplatePayload): Promise<LineItemTemplate | null> {
  if (!templateId || !payload.name.trim()) return null;

  try {
    const { data, error } = await (supabase as any)
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
      .select("id, name, description, quantity, unit, unit_price, category, created_at")
      .single();

    if (error) throw error;
    return data ? toTemplate(data) : null;
  } catch (error) {
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
      });
      if (!uniqueByFingerprint.has(key)) {
        uniqueByFingerprint.set(key, template);
      }
    }

    const payload = Array.from(uniqueByFingerprint.values()).map((template) =>
      toInsertPayload(accountId, {
        name: template.name,
        description: template.description,
        quantity: template.quantity,
        unit: template.unit,
        unit_price: template.unit_price,
        category: template.category,
      }),
    );

    const { error: insertError } = await (supabase as any)
      .from("line_item_templates")
      .insert(payload);

    if (insertError) throw insertError;
  } catch (error) {
    console.error("Failed migrating legacy line item templates", error);
  }
}
