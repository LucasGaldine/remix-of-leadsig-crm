export async function restoreEstimateFromLatestApprovedSnapshot(
  supabase: any,
  estimate: {
    id: string;
    account_id?: string | null;
    proposal_settings?: Record<string, unknown> | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshotRaw =
    estimate.proposal_settings &&
    typeof estimate.proposal_settings === "object" &&
    estimate.proposal_settings.latest_approved_snapshot &&
    typeof estimate.proposal_settings.latest_approved_snapshot === "object"
      ? (estimate.proposal_settings.latest_approved_snapshot as Record<string, unknown>)
      : null;

  if (!snapshotRaw) {
    const { error: fallbackDeleteError } = await supabase
      .from("estimate_line_items")
      .delete()
      .eq("estimate_id", estimate.id)
      .eq("is_change_order", true)
      .eq("change_order_approved", false);

    if (fallbackDeleteError) {
      return { ok: false, error: "Failed to decline changes" };
    }

    const { error: fallbackEstimateUpdateError } = await supabase
      .from("estimates")
      .update({
        has_pending_changes: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (fallbackEstimateUpdateError) {
      return { ok: false, error: "Failed to finalize declined changes" };
    }

    return { ok: true };
  }

  const snapshotLineItems = Array.isArray(snapshotRaw.line_items) ? snapshotRaw.line_items : [];

  const { error: deleteAllLineItemsError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimate.id);

  if (deleteAllLineItemsError) {
    return { ok: false, error: "Failed to restore estimate after declining changes" };
  }

  if (snapshotLineItems.length > 0) {
    const restoreLineItems = snapshotLineItems.map((item: any, index: number) => ({
      estimate_id: estimate.id,
      account_id: estimate.account_id ?? null,
      name: item.name || "Line item",
      description: item.description || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "item",
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      sort_order: Number(item.sort_order ?? index),
      category: item.category || "other",
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
      original_line_item_id: null,
    }));

    const { error: restoreLineItemsError } = await supabase
      .from("estimate_line_items")
      .insert(restoreLineItems);

    if (restoreLineItemsError) {
      return { ok: false, error: "Failed to restore estimate after declining changes" };
    }
  }

  const { error: restoreEstimateError } = await supabase
    .from("estimates")
    .update({
      subtotal: Number(snapshotRaw.subtotal) || 0,
      tax_rate: Number(snapshotRaw.tax_rate) || 0,
      tax: Number(snapshotRaw.tax) || 0,
      discount: Number(snapshotRaw.discount) || 0,
      total: Number(snapshotRaw.total) || 0,
      has_pending_changes: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);

  if (restoreEstimateError) {
    return { ok: false, error: "Failed to restore estimate after declining changes" };
  }

  return { ok: true };
}

export async function applyEstimateVersionBeforeApproval(
  supabase: any,
  estimateId: string,
  estimateVersionId: string,
): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  const { data: version, error: versionError } = await supabase
    .from("estimate_versions")
    .select("id, estimate_id, account_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, line_items")
    .eq("id", estimateVersionId)
    .eq("estimate_id", estimateId)
    .maybeSingle();

  if (versionError || !version) {
    return { ok: false, error: "Selected estimate version was not found", statusCode: 400 };
  }

  const { error: deleteLineItemsError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);

  if (deleteLineItemsError) {
    return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
  }

  const lineItems = Array.isArray(version.line_items) ? version.line_items : [];
  if (lineItems.length > 0) {
    const inserts = lineItems.map((item: any, index: number) => ({
      estimate_id: estimateId,
      account_id: version.account_id,
      name: item.name || "Line item",
      description: item.description || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "item",
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      sort_order: Number(item.sort_order ?? index),
      category: item.category || "other",
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
      original_line_item_id: null,
    }));

    const { error: insertLineItemsError } = await supabase
      .from("estimate_line_items")
      .insert(inserts);

    if (insertLineItemsError) {
      return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
    }
  }

  const { error: updateEstimateError } = await supabase
    .from("estimates")
    .update({
      subtotal: Number(version.subtotal) || 0,
      tax_rate: Number(version.tax_rate) || 0,
      tax: Number(version.tax) || 0,
      discount: Number(version.discount) || 0,
      total: Number(version.total) || 0,
      profit_margin: Number(version.profit_margin) || 0,
      surcharge: Number(version.surcharge) || 0,
      notes: version.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);

  if (updateEstimateError) {
    return { ok: false, error: "Failed to apply selected estimate version", statusCode: 500 };
  }

  return { ok: true };
}

export async function pruneEstimateVersionsAfterApproval(
  supabase: any,
  estimateId: string,
  keepVersionId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let deleteQuery = supabase
    .from("estimate_versions")
    .delete()
    .eq("estimate_id", estimateId);

  if (keepVersionId) {
    deleteQuery = deleteQuery.neq("id", keepVersionId);
  }

  const { error } = await deleteQuery;
  if (error) {
    return { ok: false, error: "Failed to remove unused estimate versions" };
  }

  return { ok: true };
}
