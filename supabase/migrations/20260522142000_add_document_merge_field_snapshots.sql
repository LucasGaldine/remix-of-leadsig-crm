/*
  # Persist document template merge-field values

  1. job_document_configs
    - Add merge_fields_override JSONB for per-job template values

  2. job_documents
    - Add resolved_merge_fields JSONB for send-time snapshot/audit
*/

ALTER TABLE public.job_document_configs
  ADD COLUMN IF NOT EXISTS merge_fields_override jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS resolved_merge_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
