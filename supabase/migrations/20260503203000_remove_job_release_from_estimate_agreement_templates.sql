/*
  # Remove legacy job_release_agreement from estimate agreement templates
*/

UPDATE public.estimates
SET
  agreement_templates = agreement_templates - 'job_release_agreement',
  updated_at = now()
WHERE
  agreement_templates ? 'job_release_agreement';
