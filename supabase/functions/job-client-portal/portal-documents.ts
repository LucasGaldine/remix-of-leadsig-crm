export type PortalJobDocumentConfig = {
  id: string;
  lead_id: string;
  template_id: string;
  include_in_job: boolean;
  email_timing: string;
  requires_signature: boolean;
  sort_order: number;
  shared_at: string | null;
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
  const queue = Array.from(relatedLeadFamilyIds);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const batch = queue.splice(0, 50).filter((id) => !visited.has(id));
    if (batch.length === 0) continue;
    for (const id of batch) visited.add(id);

    const [relatedByIdResult, relatedByEstimateJobIdResult] = await Promise.all([
      supabase
        .from("leads")
        .select("id, estimate_job_id")
        .in("id", batch),
      supabase
        .from("leads")
        .select("id, estimate_job_id")
        .in("estimate_job_id", batch),
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
      for (const candidate of [id, estimateJobId]) {
        if (!candidate || relatedLeadFamilyIds.has(candidate)) continue;
        relatedLeadFamilyIds.add(candidate);
        queue.push(candidate);
      }
    }
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
        "id, lead_id, template_id, include_in_job, email_timing, requires_signature, sort_order, shared_at, template:document_templates(id, name, system_key, body)",
      )
      .in("lead_id", leadIds)
      .order("sort_order", { ascending: true });

  let { data: configRows, error: configError } = await readConfigs();

  if (!configError) {
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
          } else {
            const existingTemplateIds = new Set(
              ((configRows || []) as any[])
                .map((row) => String((row as any)?.template_id || ""))
                .filter(Boolean),
            );
            const templatesToInsert = (templateRows || [])
              .map((row: any) => ({
                id: String(row?.id || ""),
                default_email_timing: String(row?.default_email_timing || "never"),
                default_requires_signature: row?.default_requires_signature === true,
              }))
              .filter((row) => row.id.length > 0 && !existingTemplateIds.has(row.id));

            if (templatesToInsert.length > 0) {
              const insertPayload = templatesToInsert.map((template, index) => ({
                lead_id: defaultLeadId,
                account_id: accountId,
                template_id: template.id,
                include_in_job: true,
                email_timing: template.default_email_timing,
                requires_signature: template.default_requires_signature,
                sort_order: (configRows || []).length + index,
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
          shared_at: rawRow?.shared_at ? String(rawRow.shared_at) : null,
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

  if (configs.length === 0 && documents.length > 0) {
    const templateIds = Array.from(
      new Set(documents.map((document) => String(document.template_id || "")).filter(Boolean)),
    );
    const templateById = new Map<string, { id: string; name: string; system_key: string | null; body: string | null }>();

    if (templateIds.length > 0) {
      const { data: templateRows, error: templateRowsError } = await supabase
        .from("document_templates")
        .select("id, name, system_key, body")
        .in("id", templateIds);

      if (templateRowsError) {
        console.error(`Failed to fetch ${errorContext} templates for synthetic configs:`, templateRowsError);
      } else {
        for (const row of templateRows || []) {
          const id = String((row as any)?.id || "");
          if (!id) continue;
          templateById.set(id, {
            id,
            name: String((row as any)?.name || ""),
            system_key: (row as any)?.system_key ? String((row as any).system_key) : null,
            body: typeof (row as any)?.body === "string" ? String((row as any).body) : null,
          });
        }
      }
    }

    const syntheticConfigsByKey = new Map<string, PortalJobDocumentConfig>();
    for (let index = 0; index < documents.length; index += 1) {
      const document = documents[index];
      const templateId = String(document.template_id || "");
      const dedupeKey = templateId || `legacy:${String(document.document_key || document.id)}`;
      if (syntheticConfigsByKey.has(dedupeKey)) continue;

      const template = templateId ? templateById.get(templateId) : null;
      syntheticConfigsByKey.set(dedupeKey, {
        id: `virtual:${dedupeKey}`,
        lead_id: String(document.lead_id || leadIds[0] || ""),
        template_id: templateId,
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        sort_order: index,
        shared_at: document.created_at || null,
        template: template
          ? {
              id: template.id,
              name: template.name || "Document",
              system_key: template.system_key,
              body: template.body,
            }
          : {
              id: templateId,
              name: String(document.file_name || "Document"),
              system_key: null,
              body: null,
            },
      });
    }

    configs = Array.from(syntheticConfigsByKey.values());
  }

  return {
    leadIds,
    leadId: leadIds[0] || null,
    configs,
    documents,
  };
}
