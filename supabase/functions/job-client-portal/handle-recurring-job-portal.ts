import { resolveAgreementTemplatesForEstimates } from "./agreement-templates.ts";
import { handleEstimateAction } from "./handle-estimate-action.ts";
import { fetchPortalDocumentsForLeadFamily } from "./portal-documents.ts";

export async function handleRecurringJobPortal(
  supabase: any,
  supabaseUrl: string,
  recurringJob: any,
  req: Request,
  jsonResponse: (body: unknown, status?: number) => Response,
) {
  if (req.method === "POST") {
    const body = await req.json();
    const action = body.action;
    const clientUpdatedAt = body.updated_at;
    const estimateVersionId = typeof body.estimate_version_id === "string" ? body.estimate_version_id : null;
    const signatureDataUrl =
      typeof body.signature_data_url === "string"
        ? body.signature_data_url
        : typeof body.signatureDataUrl === "string"
          ? body.signatureDataUrl
          : null;
    const agreementAcceptance =
      body && typeof body.agreement_acceptance === "object" && body.agreement_acceptance
        ? body.agreement_acceptance
        : null;
    const agreementTemplates =
      body && typeof body.agreement_templates === "object" && body.agreement_templates
        ? body.agreement_templates
        : null;
    let requiredDocumentConfigIds: string[] = [];

    if (action !== "approve" && action !== "decline" && action !== "approve_changes" && action !== "decline_changes") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select("id, status, expires_at, job_id, recurring_job_id, updated_at, has_pending_changes, account_id, proposal_settings")
      .eq("recurring_job_id", recurringJob.id)
      .maybeSingle();

    if (estError || !estimate) {
      return jsonResponse({ error: "No quote found for this job schedule" }, 404);
    }
    if (action === "approve") {
      const baseDocumentLeadIds = [
        typeof estimate?.job_id === "string" ? estimate.job_id : null,
        ...((await supabase
          .from("leads")
          .select("id")
          .eq("recurring_job_id", recurringJob.id)).data || []).map((row: any) => String(row.id || "")),
      ].filter((value): value is string => Boolean(value));
      const portalDocuments = await fetchPortalDocumentsForLeadFamily(
        supabase,
        supabaseUrl,
        baseDocumentLeadIds,
        "recurring approval required documents",
      );
      requiredDocumentConfigIds = (portalDocuments.configs || [])
        .filter((config: any) => {
          const timing = String(config?.email_timing || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
          return config?.include_in_job === true
            && timing === "on_estimate_approval"
            && config?.requires_signature === true;
        })
        .map((config: any) => String(config.id || ""))
        .filter(Boolean);
    }

    return await handleEstimateAction(
      supabase,
      estimate,
      action,
      null,
      jsonResponse,
      clientUpdatedAt,
      estimateVersionId,
      signatureDataUrl,
      agreementAcceptance,
      agreementTemplates,
      requiredDocumentConfigIds,
    );
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { data: instances } = await supabase
    .from("leads")
    .select("id, name, status, recurring_instance_number")
    .eq("recurring_job_id", recurringJob.id)
    .order("recurring_instance_number", { ascending: true });

  const instanceIds = (instances || []).map((i: any) => i.id);

  const [
    { data: account },
    { data: estimate },
    { data: allSchedules },
    { data: allBeforePhotos },
    { data: allAfterPhotos },
    { data: allInteractions },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings")
      .eq("id", recurringJob.account_id)
      .maybeSingle(),

    supabase
      .from("estimates")
      .select(`
        id, job_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at, accepted_at, approved_via, manual_approval_photo_url,
        original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
        proposal_settings, project_visualization_image_url, agreement_templates, agreement_acceptance,
        line_items:estimate_line_items(
          id, name, description, quantity, unit, unit_price, total,
          sort_order, is_change_order, change_order_type, change_order_approved, changed_at
        )
      `)
      .eq("recurring_job_id", recurringJob.id)
      .maybeSingle(),

    instanceIds.length > 0
      ? supabase
          .from("job_schedules")
          .select("id, lead_id, scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
          .in("lead_id", instanceIds)
          .order("scheduled_date", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("lead_photos")
          .select("id, lead_id, file_path, created_at")
          .in("lead_id", instanceIds)
          .eq("photo_type", "before")
          .order("created_at", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("lead_photos")
          .select("id, lead_id, file_path, created_at")
          .in("lead_id", instanceIds)
          .eq("photo_type", "after")
          .order("created_at", { ascending: true })
      : { data: [] },

    instanceIds.length > 0
      ? supabase
          .from("interactions")
          .select("id, type, summary, created_at, lead_id")
          .in("lead_id", instanceIds)
          .in("type", ["note", "status_change", "call", "email", "sms"])
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] },
  ]);

  const buildPhotoUrls = (photos: any[] | null) =>
    (photos || []).map((p: any) => ({
      id: p.id,
      url: `${supabaseUrl}/storage/v1/object/public/lead-photos/${p.file_path}`,
      created_at: p.created_at,
    }));

  const filteredLineItems = estimate
    ? (estimate.line_items || [])
        .filter((li: any) => !li.is_change_order || li.change_order_type !== "deleted")
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    : [];

  let originalLineItemsRecurring = null;
  if (estimate?.original_total) {
    const { data: originals } = await supabase
      .from("estimate_line_items_original")
      .select("id, original_line_item_id, name, description, quantity, unit, unit_price, total, sort_order")
      .eq("estimate_id", estimate.id)
      .order("sort_order");
    originalLineItemsRecurring = originals;
  }

  const { data: estimateVersionsRecurring } = estimate
    ? await supabase
        .from("estimate_versions")
        .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const recurringScopeJobIds = [
    typeof estimate?.job_id === "string" ? estimate.job_id : null,
  ].filter((value): value is string => Boolean(value));

  let recurringScopeItems: string[] = [];
  if (recurringScopeJobIds.length > 0) {
    const { data: recurringChecklistRows } = await supabase
      .from("job_checklist_items")
      .select("job_id, label, sort_order")
      .in("job_id", recurringScopeJobIds)
      .order("sort_order", { ascending: true });

    const grouped = new Map<string, string[]>();
    for (const row of recurringChecklistRows || []) {
      const label = String((row as any).label || "").trim();
      const rowJobId = String((row as any).job_id || "");
      if (!label || !rowJobId) continue;
      const current = grouped.get(rowJobId) || [];
      current.push(label);
      grouped.set(rowJobId, current);
    }

    for (const candidateJobId of recurringScopeJobIds) {
      const items = grouped.get(candidateJobId) || [];
      if (items.length > 0) {
        recurringScopeItems = items;
        break;
      }
    }
  }

  const instanceMap = new Map((instances || []).map((i: any) => [i.id, i]));
  const schedulesWithVisit = (allSchedules || []).map((s: any) => {
    const inst = instanceMap.get(s.lead_id);
    return {
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
      visit_number: inst?.recurring_instance_number || null,
      visit_status: inst?.status || null,
    };
  });

  const recurringResolvedAgreement = resolveAgreementTemplatesForEstimates([estimate]);
  const portalDocuments = await fetchPortalDocumentsForLeadFamily(
    supabase,
    supabaseUrl,
    [...recurringScopeJobIds, ...instanceIds],
    "recurring portal job documents",
  );

  return jsonResponse({
    job: {
      name: recurringJob.name,
      address: recurringJob.address,
      service_type: recurringJob.service_type,
      status: "recurring",
      description: recurringJob.description,
      created_at: null,
      customer: recurringJob.customer,
      is_recurring: true,
      frequency: recurringJob.frequency,
    },
    company: account
      ? {
          company_name: account.company_name,
          company_email: account.company_email,
          company_phone: account.company_phone,
          logo_url: account.logo_url,
          portal_color: account.settings?.client_portal_color ?? null,
          portal_text_color: account.settings?.client_portal_text_color ?? null,
          client_portal_color: account.settings?.client_portal_color ?? null,
          client_portal_text_color: account.settings?.client_portal_text_color ?? null,
          settings: account.settings ?? null,
        }
      : {},
    schedules: schedulesWithVisit,
    estimate: estimate
      ? {
          id: estimate.id,
          job_id: estimate.job_id ?? null,
          total: estimate.total,
          subtotal: estimate.subtotal,
          profit_margin: estimate.profit_margin,
          tax_rate: estimate.tax_rate,
          tax: estimate.tax,
          discount: estimate.discount,
          notes: estimate.notes,
          status: estimate.status,
          updated_at: estimate.updated_at,
          accepted_at: estimate.accepted_at ?? null,
          approved_via: estimate.approved_via ?? null,
          manual_approval_photo_url: estimate.manual_approval_photo_url ?? null,
          line_items: filteredLineItems,
          original_total: estimate.original_total,
          original_subtotal: estimate.original_subtotal,
          original_tax: estimate.original_tax,
          original_discount: estimate.original_discount,
          original_notes: estimate.original_notes,
          original_line_items: originalLineItemsRecurring,
          has_pending_changes: estimate.has_pending_changes,
          proposal_settings: estimate.proposal_settings || null,
          scope_of_work_items: recurringScopeItems,
          project_visualization_image_url: estimate.project_visualization_image_url || null,
          agreement_templates: recurringResolvedAgreement.templates,
          agreement_source_estimate_id: recurringResolvedAgreement.sourceEstimateId,
          agreement_acceptance: estimate.agreement_acceptance || null,
          estimate_versions: estimateVersionsRecurring || [],
          job_document_config_lead_id: portalDocuments.leadId,
          job_document_configs: portalDocuments.configs,
          job_documents: portalDocuments.documents,
        }
      : null,
    photos: {
      before: buildPhotoUrls(allBeforePhotos),
      after: buildPhotoUrls(allAfterPhotos),
    },
    invoice: null,
    estimate_visit_schedules: [],
    activity: (allInteractions || []).map((i: any) => ({
      type: i.type,
      summary: i.summary,
      created_at: i.created_at,
    })),
  });
}
