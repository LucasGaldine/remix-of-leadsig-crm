ALTER TABLE public.job_document_configs
  ADD COLUMN IF NOT EXISTS shared_at timestamptz NULL;

COMMENT ON COLUMN public.job_document_configs.shared_at IS
  'When this configured job document first became shared/customer-visible. Estimate approval documents are shared by default.';

UPDATE public.job_document_configs
SET shared_at = COALESCE(shared_at, updated_at, created_at, now())
WHERE shared_at IS NULL
  AND email_timing = 'on_estimate_approval';

WITH first_config_document AS (
  SELECT config_id, MIN(created_at) AS first_shared_at
  FROM public.job_documents
  WHERE config_id IS NOT NULL
  GROUP BY config_id
)
UPDATE public.job_document_configs AS config
SET shared_at = COALESCE(config.shared_at, first_config_document.first_shared_at)
FROM first_config_document
WHERE config.id = first_config_document.config_id
  AND config.shared_at IS NULL;

WITH first_template_document AS (
  SELECT lead_id, template_id, MIN(created_at) AS first_shared_at
  FROM public.job_documents
  WHERE config_id IS NULL
    AND template_id IS NOT NULL
  GROUP BY lead_id, template_id
)
UPDATE public.job_document_configs AS config
SET shared_at = COALESCE(config.shared_at, first_template_document.first_shared_at)
FROM first_template_document
WHERE config.lead_id = first_template_document.lead_id
  AND config.template_id = first_template_document.template_id
  AND config.shared_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_estimate_approval_document_shared_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email_timing = 'on_estimate_approval' AND NEW.shared_at IS NULL THEN
    NEW.shared_at := COALESCE(NEW.updated_at, NEW.created_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_document_configs_estimate_approval_shared_at
  ON public.job_document_configs;

CREATE TRIGGER trg_job_document_configs_estimate_approval_shared_at
  BEFORE INSERT OR UPDATE OF email_timing, shared_at, updated_at
  ON public.job_document_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_estimate_approval_document_shared_at();
