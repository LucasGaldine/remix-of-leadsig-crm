export type PortalJobDocumentConfig = {
  id: string;
  lead_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: string;
  requires_signature: boolean;
  sort_order: number;
  template: {
    id: string;
    name: string;
    system_key: string | null;
    body: string | null;
  } | null;
};

export type PortalJobDocument = {
  id: string;
  lead_id: string;
  template_id: string | null;
  config_id: string | null;
  document_key: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
  url: string;
};

async function expandLeadFamilyIds(supabase: any, seedLeadIds: string[], errorContext: string) {
  const relatedLeadFamilyIds = new Set<string>(seedLeadIds.filter(Boolean));

  if (seedLeadIds.length === 0) {
    return Array.from(relatedLeadFamilyIds);
  }

  const [relatedByIdResult, relatedByEstimateJobIdResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id, estimate_job_id")
      .in("id", seedLeadIds),
    supabase
      .from("leads")
      .select("id, estimate_job_id")
      .in("estimate_job_id", seedLeadIds),
  ]);

  if (relatedByIdResult.error) {
    console.error(`Failed to fetch ${errorContext} related leads by id:`, relatedByIdResult.error);
  }
  if (relatedByEstimateJobIdResult.error) {
    console.error(
      `Failed to fetch ${errorContext} related leads by estimate_job_id:`,
      relatedByEstimateJobIdResult.error,
    );
  }

  const relatedLeadRows = [
    ...(relatedByIdResult.data || []),
    ...(relatedByEstimateJobIdResult.data || []),
  ];

  for (const row of relatedLeadRows) {
    const id = String((row as any)?.id || "");
    const estimateJobId = String((row as any)?.estimate_job_id || "");
    if (id) relatedLeadFamilyIds.add(id);
    if (estimateJobId) relatedLeadFamilyIds.add(estimateJobId);
  }

  return Array.from(relatedLeadFamilyIds);
}

export async function fetchPortalDocumentsForLeadFamily(
  supabase: any,
  supabaseUrl: string,
  seedLeadIds: string[],
  errorContext = "portal documents",
): Promise<{
  leadIds: string[];
  leadId: string | null;
  configs: PortalJobDocumentConfig[];
  documents: PortalJobDocument[];
}> {
  const leadIds = await expandLeadFamilyIds(supabase, seedLeadIds, errorContext);

  if (leadIds.length === 0) {
    return {
      leadIds,
      leadId: null,
      configs: [],
      documents: [],
    };
  }

  const readConfigs = async () =>
    supabase
      .from("job_document_configs")
      .select(
        "id, lead_id, template_id, include_in_job, email_timing, requires_signature, sort_order, template:document_templates(id, name, system_key, body)",
      )
      .in("lead_id", leadIds)
      .order("sort_order", { ascending: true });

  let { data: configRows, error: configError } = await readConfigs();

  if (!configError && (configRows || []).length === 0) {
    const defaultLeadId = seedLeadIds.find(Boolean) || leadIds[0] || null;
    if (defaultLeadId) {
      const { data: leadRow, error: leadError } = await supabase
        .from("leads")
        .select("id, account_id")
        .eq("id", defaultLeadId)
        .maybeSingle();

      if (leadError) {
        console.error(`Failed to fetch ${errorContext} lead for default config seed:`, leadError);
      } else {
        const accountId = String(leadRow?.account_id || "");
        if (accountId) {
          const { data: templateRows, error: templateError } = await supabase
            .from("document_templates")
            .select("id, default_email_timing, default_requires_signature")
            .eq("account_id", accountId)
            .eq("default_included_in_jobs", true)
            .order("created_at", { ascending: true });

          if (templateError) {
            console.error(`Failed to fetch ${errorContext} default templates for config seed:`, templateError);
          }
          else {
            const templates = (templateRows || []).filter((row: any) => String(row?.id || ""));
            if (templates.length > 0) {
              const insertPayload = templates.map((template: any, index: number) => ({
                lead_id: defaultLeadId,
                account_id: accountId,
                template_id: String(template.id),
                include_in_job: true,
                email_timing: String(template.default_email_timing || "never"),
                requires_signature: template.default_requires_signature === true,
                sort_order: index,
                created_by: null,
              }));

              const { error: seedError } = await supabase
                .from("job_document_configs")
                .insert(insertPayload);

              if (seedError) {
                console.error(`Failed to seed ${errorContext} default configs:`, seedError);
              } else {
                const refreshed = await readConfigs();
                configRows = refreshed.data;
                configError = refreshed.error;
              }
            }
          }
        }
      }
    }
  }

  let configs: PortalJobDocumentConfig[] = [];
  if (configError) {
    console.error(`Failed to fetch ${errorContext} configs:`, configError);
  } else {
    const normalizedConfigRows = (configRows || [])
      .map((rawRow: any) => {
        const templateRaw = rawRow?.template;
        const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
        return {
          id: String(rawRow?.id || ""),
          lead_id: String(rawRow?.lead_id || ""),
          template_id: String(rawRow?.template_id || ""),
          include_in_job: rawRow?.include_in_job === true,
          email_timing: String(rawRow?.email_timing || "never"),
          requires_signature: rawRow?.requires_signature === true,
          sort_order: Number(rawRow?.sort_order || 0),
          template: template
            ? {
                id: String(template.id || ""),
                name: String(template.name || ""),
                system_key: template.system_key ? String(template.system_key) : null,
                body: typeof template.body === "string" ? template.body : null,
              }
            : null,
        };
      })
      .filter((row) => Boolean(row.id) && Boolean(row.lead_id));

    const leadPriority = new Map(leadIds.map((id, index) => [id, index]));
    configs = normalizedConfigRows.sort((a, b) => {
      const aPriority = leadPriority.get(a.lead_id) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = leadPriority.get(b.lead_id) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.sort_order - b.sort_order;
    });
  }

  const { data: documentRows, error: documentsError } = await supabase
    .from("job_documents")
    .select("id, lead_id, template_id, config_id, document_key, file_name, file_path, mime_type, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });

  let documents: PortalJobDocument[] = [];
  if (documentsError) {
    console.error(`Failed to fetch ${errorContext} records:`, documentsError);
  } else {
    const selectedConfigIds = new Set(configs.map((config) => config.id));
    const selectedTemplateIds = new Set(configs.map((config) => config.template_id).filter(Boolean));

    documents = (documentRows || [])
      .map((rawDocument: any) => ({
        id: String(rawDocument?.id || ""),
        lead_id: String(rawDocument?.lead_id || ""),
        template_id: rawDocument?.template_id ? String(rawDocument.template_id) : null,
        config_id: rawDocument?.config_id ? String(rawDocument.config_id) : null,
        document_key: String(rawDocument?.document_key || ""),
        file_name: String(rawDocument?.file_name || ""),
        file_path: String(rawDocument?.file_path || ""),
        mime_type: rawDocument?.mime_type ? String(rawDocument.mime_type) : null,
        created_at: String(rawDocument?.created_at || ""),
        url: `${supabaseUrl}/storage/v1/object/public/job-documents/${rawDocument.file_path}`,
      }))
      .filter((document) => {
        if (!document.id || !document.file_path) return false;
        if (document.config_id && selectedConfigIds.has(document.config_id)) return true;
        if (selectedConfigIds.size === 0) return true;
        if (document.template_id && selectedTemplateIds.has(document.template_id)) return true;
        return leadIds.includes(document.lead_id);
      });
  }

  return {
    leadIds,
    leadId: leadIds[0] || null,
    configs,
    documents,
  };
}
