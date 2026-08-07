import { fetchPortalDocumentsForLeadFamily } from "./portal-documents.ts";
import { getJobReleaseForLead, isLeadFullyPaid } from "./job-release.ts";

export async function handleSingleJobGet(
  supabase: any,
  supabaseUrl: string,
  job: any,
  jsonResponse: (body: unknown, status?: number) => Response,
) {
  const [
    { data: account },
    { data: schedules },
    { data: estimate },
    { data: beforePhotos },
    { data: afterPhotos },
    { data: interactions },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("company_name, company_email, company_phone, logo_url, settings")
      .eq("id", job.account_id)
      .maybeSingle(),

    supabase
      .from("job_schedules")
      .select("id, scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
      .eq("lead_id", job.id)
      .order("scheduled_date", { ascending: true }),

    supabase
      .from("estimates")
      .select(
        `
        id, job_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at, accepted_at, approved_via, manual_approval_photo_url,
        original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
        proposal_settings, project_visualization_image_url, agreement_acceptance,
        line_items:estimate_line_items(
          id, name, description, quantity, unit, unit_price, total,
          sort_order, is_change_order, change_order_type, change_order_approved, changed_at
        )
      `
      )
      .eq("job_id", job.id)
      .maybeSingle(),

    supabase
      .from("lead_photos")
      .select("id, file_path, created_at")
      .eq("lead_id", job.id)
      .eq("photo_type", "before")
      .order("created_at", { ascending: true }),

    supabase
      .from("lead_photos")
      .select("id, file_path, created_at")
      .eq("lead_id", job.id)
      .eq("photo_type", "after")
      .order("created_at", { ascending: true }),

    supabase
      .from("interactions")
      .select("id, type, summary, created_at")
      .eq("lead_id", job.id)
      .in("type", ["note", "status_change", "call", "email", "sms"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let parentEstimate = estimate;
  if (!parentEstimate && job.estimate_job_id) {
    const { data: parentLead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", job.estimate_job_id)
      .maybeSingle();

    if (parentLead) {
      const { data: pe } = await supabase
        .from("estimates")
        .select(
          `
          id, job_id, subtotal, tax_rate, tax, discount, total, profit_margin, surcharge, notes, status, created_at, updated_at, accepted_at, approved_via, manual_approval_photo_url,
          original_subtotal, original_tax, original_discount, original_total, original_notes, has_pending_changes,
          proposal_settings, project_visualization_image_url, agreement_acceptance,
          line_items:estimate_line_items(
            id, name, description, quantity, unit, unit_price, total,
            sort_order, is_change_order, change_order_type, change_order_approved
          )
        `
        )
        .eq("job_id", parentLead.id)
        .maybeSingle();
      parentEstimate = pe;
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, stripe_invoice_url, status")
    .eq("lead_id", job.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fullyPaid = await isLeadFullyPaid(supabase, job.id);
  const jobRelease = await getJobReleaseForLead(supabase, job.id);

  let estimateVisitSchedules: any[] = [];
  if (job.estimate_job_id) {
    const { data: evSchedules } = await supabase
      .from("job_schedules")
      .select("scheduled_date, scheduled_time_start, scheduled_time_end, is_completed")
      .eq("lead_id", job.estimate_job_id)
      .order("scheduled_date", { ascending: true });
    estimateVisitSchedules = evSchedules || [];
  }

  const buildPhotoUrls = (photos: any[] | null) =>
    (photos || []).map((p: any) => ({
      id: p.id,
      url: `${supabaseUrl}/storage/v1/object/public/lead-photos/${p.file_path}`,
      created_at: p.created_at,
    }));

  const filteredLineItems = parentEstimate
    ? (parentEstimate.line_items || [])
        .filter(
          (li: any) =>
            !li.is_change_order || li.change_order_type !== "deleted"
        )
        .sort(
          (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
        )
    : [];

  let originalLineItems = null;
  if (parentEstimate?.original_total) {
    const { data: originals } = await supabase
      .from("estimate_line_items_original")
      .select("id, original_line_item_id, name, description, quantity, unit, unit_price, total, sort_order")
      .eq("estimate_id", parentEstimate.id)
      .order("sort_order");
    originalLineItems = originals;
  }

  const { data: estimateVersions } = parentEstimate
    ? await supabase
        .from("estimate_versions")
        .select("id, name, subtotal, tax_rate, tax, discount, total, profit_margin, notes, line_items, created_at, updated_at")
        .eq("estimate_id", parentEstimate.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const scopeJobIds = [
    typeof job?.id === "string" ? job.id : null,
    typeof job?.estimate_job_id === "string" ? job.estimate_job_id : null,
    typeof estimate?.job_id === "string" ? estimate.job_id : null,
    typeof parentEstimate?.job_id === "string" ? parentEstimate.job_id : null,
  ].filter((value): value is string => Boolean(value));

  let scopeItems: string[] = [];
  if (scopeJobIds.length > 0) {
    const { data: checklistRows } = await supabase
      .from("job_checklist_items")
      .select("job_id, label, sort_order")
      .in("job_id", scopeJobIds)
      .order("sort_order", { ascending: true });

    const grouped = new Map<string, string[]>();
    for (const row of checklistRows || []) {
      const label = String((row as any).label || "").trim();
      const rowJobId = String((row as any).job_id || "");
      if (!label || !rowJobId) continue;
      const current = grouped.get(rowJobId) || [];
      current.push(label);
      grouped.set(rowJobId, current);
    }

    for (const candidateJobId of scopeJobIds) {
      const items = grouped.get(candidateJobId) || [];
      if (items.length > 0) {
        scopeItems = items;
        break;
      }
    }
  }

  const baseDocumentLeadIds = [
    typeof parentEstimate?.job_id === "string" ? parentEstimate.job_id : null,
    typeof estimate?.job_id === "string" ? estimate.job_id : null,
    typeof job?.estimate_job_id === "string" ? job.estimate_job_id : null,
    typeof job?.id === "string" ? job.id : null,
  ].filter((value): value is string => Boolean(value));
  const portalDocuments = await fetchPortalDocumentsForLeadFamily(
    supabase,
    supabaseUrl,
    baseDocumentLeadIds,
    "portal job documents",
  );

  return jsonResponse({
    job: {
      name: job.name,
      address: job.address,
      service_type: job.service_type,
      status: job.status,
      description: job.description,
      created_at: job.created_at,
      customer: job.customer,
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
    schedules: (schedules || []).map((s: any) => ({
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
    })),
    estimate: parentEstimate
      ? {
          id: parentEstimate.id,
          job_id: parentEstimate.job_id ?? null,
          total: parentEstimate.total,
          subtotal: parentEstimate.subtotal,
          profit_margin: parentEstimate.profit_margin,
          tax_rate: parentEstimate.tax_rate,
          tax: parentEstimate.tax,
          discount: parentEstimate.discount,
          notes: parentEstimate.notes,
          status: parentEstimate.status,
          updated_at: parentEstimate.updated_at,
          accepted_at: parentEstimate.accepted_at ?? null,
          approved_via: parentEstimate.approved_via ?? null,
          manual_approval_photo_url: parentEstimate.manual_approval_photo_url ?? null,
          line_items: filteredLineItems,
          original_total: parentEstimate.original_total,
          original_subtotal: parentEstimate.original_subtotal,
          original_tax: parentEstimate.original_tax,
          original_discount: parentEstimate.original_discount,
          original_notes: parentEstimate.original_notes,
          original_line_items: originalLineItems,
          has_pending_changes: parentEstimate.has_pending_changes,
          proposal_settings: parentEstimate.proposal_settings || null,
          scope_of_work_items: scopeItems,
          project_visualization_image_url: parentEstimate.project_visualization_image_url || null,
          agreement_acceptance: parentEstimate.agreement_acceptance || null,
          estimate_versions: estimateVersions || [],
          job_document_config_lead_id: portalDocuments.leadId,
          job_document_configs: portalDocuments.configs,
          job_documents: portalDocuments.documents,
        }
      : null,
    photos: {
      before: buildPhotoUrls(beforePhotos),
      after: buildPhotoUrls(afterPhotos),
    },
    invoice: invoice ? {
      stripe_invoice_url: invoice.stripe_invoice_url,
      status: invoice.status,
    } : null,
    job_release: jobRelease
      ? {
          id: jobRelease.id,
          status: jobRelease.status,
          release_text: jobRelease.release_text,
          signed_at: jobRelease.signed_at,
          signature_image_url: jobRelease.signature_image_url,
          requested_at: jobRelease.requested_at,
        }
      : null,
    is_fully_paid: fullyPaid,
    estimate_visit_schedules: estimateVisitSchedules.map((s: any) => ({
      scheduled_date: s.scheduled_date,
      scheduled_time_start: s.scheduled_time_start,
      scheduled_time_end: s.scheduled_time_end,
      is_completed: s.is_completed,
    })),
    activity: (interactions || []).map((i: any) => ({
      type: i.type,
      summary: i.summary,
      created_at: i.created_at,
    })),
  });
}
