/*
  # Allow duplicate document templates per job

  1. job_document_configs
    - Drop unique constraint on (lead_id, template_id)
    - Keep non-unique index for lookup performance

  2. job_documents
    - Add config_id link to job_document_configs
    - Drop unique index on (lead_id, template_id) so multiple documents per template are allowed
    - Add unique index on (lead_id, config_id) for one document per config instance
*/

ALTER TABLE public.job_document_configs
  DROP CONSTRAINT IF EXISTS job_document_configs_lead_template_key;

CREATE INDEX IF NOT EXISTS idx_job_document_configs_lead_template
  ON public.job_document_configs (lead_id, template_id);

ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS config_id uuid NULL REFERENCES public.job_document_configs(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_job_documents_lead_template_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_documents_lead_config_unique
  ON public.job_documents (lead_id, config_id)
  WHERE config_id IS NOT NULL;

