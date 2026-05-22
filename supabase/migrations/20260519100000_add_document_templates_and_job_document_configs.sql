/*
  # Add Document Templates and Job Document Configs

  1. New tables
    - document_templates (account-level template library)
    - job_document_configs (per-job template selection + overrides)

  2. Backfill
    - Seed default templates (Job Agreement, Warranty, Job Release) for each account
    - Seed per-job configs from default templates

  3. Existing table updates
    - Extend job_documents to support template-linked documents
*/

CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  system_key text NULL CHECK (system_key IS NULL OR system_key = ANY (ARRAY['job_agreement', 'warranty_agreement', 'job_release'])),
  body text NOT NULL DEFAULT '',
  default_included_in_jobs boolean NOT NULL DEFAULT true,
  default_email_timing text NOT NULL DEFAULT 'never' CHECK (default_email_timing = ANY (ARRAY['never', 'on_estimate_approval', 'on_job_completion', 'manual'])),
  default_requires_signature boolean NOT NULL DEFAULT false,
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_templates_account_slug_key UNIQUE (account_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_templates_account_system_key_unique
  ON public.document_templates (account_id, system_key)
  WHERE system_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_templates_account_id
  ON public.document_templates (account_id);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view document templates" ON public.document_templates;
CREATE POLICY "Account members can view document templates"
  ON public.document_templates
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Account members can insert document templates" ON public.document_templates;
CREATE POLICY "Account members can insert document templates"
  ON public.document_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND (created_by IS NULL OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Account members can update document templates" ON public.document_templates;
CREATE POLICY "Account members can update document templates"
  ON public.document_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())))
  WITH CHECK (public.is_account_member(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Account members can delete document templates" ON public.document_templates;
CREATE POLICY "Account members can delete document templates"
  ON public.document_templates
  FOR DELETE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.job_document_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  include_in_job boolean NOT NULL DEFAULT true,
  email_timing text NOT NULL DEFAULT 'never' CHECK (email_timing = ANY (ARRAY['never', 'on_estimate_approval', 'on_job_completion', 'manual'])),
  requires_signature boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_document_configs_lead_template_key UNIQUE (lead_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_job_document_configs_account_id
  ON public.job_document_configs (account_id);

CREATE INDEX IF NOT EXISTS idx_job_document_configs_lead_id
  ON public.job_document_configs (lead_id);

CREATE INDEX IF NOT EXISTS idx_job_document_configs_template_id
  ON public.job_document_configs (template_id);

ALTER TABLE public.job_document_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view job document configs" ON public.job_document_configs;
CREATE POLICY "Account members can view job document configs"
  ON public.job_document_configs
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Account members can insert job document configs" ON public.job_document_configs;
CREATE POLICY "Account members can insert job document configs"
  ON public.job_document_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND (created_by IS NULL OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Account members can update job document configs" ON public.job_document_configs;
CREATE POLICY "Account members can update job document configs"
  ON public.job_document_configs
  FOR UPDATE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())))
  WITH CHECK (public.is_account_member(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Account members can delete job document configs" ON public.job_document_configs;
CREATE POLICY "Account members can delete job document configs"
  ON public.job_document_configs
  FOR DELETE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

INSERT INTO public.document_templates (
  account_id,
  name,
  slug,
  system_key,
  body,
  default_included_in_jobs,
  default_email_timing,
  default_requires_signature,
  created_by
)
SELECT
  accounts.id,
  template_seed.name,
  template_seed.slug,
  template_seed.system_key,
  template_seed.body,
  template_seed.default_included_in_jobs,
  template_seed.default_email_timing,
  template_seed.default_requires_signature,
  NULL
FROM public.accounts
CROSS JOIN (
  VALUES
    ('Job Agreement', 'job-agreement', 'job_agreement', '', true, 'on_estimate_approval', true),
    ('Warranty', 'warranty', 'warranty_agreement', '', true, 'on_estimate_approval', true),
    ('Job Release', 'job-release', 'job_release', '', true, 'on_job_completion', true)
) AS template_seed(name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature)
ON CONFLICT (account_id, slug)
DO NOTHING;

INSERT INTO public.job_document_configs (
  lead_id,
  account_id,
  template_id,
  include_in_job,
  email_timing,
  requires_signature,
  sort_order,
  created_by
)
SELECT
  leads.id,
  leads.account_id,
  templates.id,
  templates.default_included_in_jobs,
  templates.default_email_timing,
  templates.default_requires_signature,
  row_number() OVER (PARTITION BY leads.id ORDER BY templates.name) - 1,
  NULL
FROM public.leads
JOIN public.document_templates AS templates
  ON templates.account_id = leads.account_id
  AND templates.default_included_in_jobs = true
ON CONFLICT (lead_id, template_id)
DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_documents'
      AND column_name = 'document_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_documents'
      AND column_name = 'document_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.job_documents RENAME COLUMN document_type TO document_key';
  END IF;
END $$;

ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS template_id uuid NULL REFERENCES public.document_templates(id) ON DELETE SET NULL;

ALTER TABLE public.job_documents
  DROP CONSTRAINT IF EXISTS job_documents_document_type_check;

ALTER TABLE public.job_documents
  DROP CONSTRAINT IF EXISTS job_documents_lead_document_type_key;

ALTER TABLE public.job_documents
  DROP CONSTRAINT IF EXISTS job_documents_lead_document_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_documents_lead_template_unique
  ON public.job_documents (lead_id, template_id)
  WHERE template_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_documents_lead_document_key_unique
  ON public.job_documents (lead_id, document_key)
  WHERE template_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_documents_template_id
  ON public.job_documents (template_id);

CREATE INDEX IF NOT EXISTS idx_job_documents_document_key
  ON public.job_documents (document_key);

DROP INDEX IF EXISTS idx_job_documents_document_type;
