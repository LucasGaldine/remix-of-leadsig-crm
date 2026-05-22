/*
  # Backfill default document template bodies from existing agreements

  This migration populates empty system template bodies using existing account data:
  - job_agreement / warranty_agreement: latest non-empty estimates.agreement_templates value
  - job_release: latest non-empty job_releases.release_text value
*/

WITH latest_job_agreement AS (
  SELECT DISTINCT ON (l.account_id)
    l.account_id,
    NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '') AS body
  FROM public.estimates e
  JOIN public.leads l
    ON l.id = e.job_id
  WHERE NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '') IS NOT NULL
  ORDER BY l.account_id, COALESCE(e.updated_at, e.created_at) DESC, e.id DESC
),
latest_warranty AS (
  SELECT DISTINCT ON (l.account_id)
    l.account_id,
    NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '') AS body
  FROM public.estimates e
  JOIN public.leads l
    ON l.id = e.job_id
  WHERE NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '') IS NOT NULL
  ORDER BY l.account_id, COALESCE(e.updated_at, e.created_at) DESC, e.id DESC
),
latest_job_release AS (
  SELECT DISTINCT ON (jr.account_id)
    jr.account_id,
    NULLIF(BTRIM(COALESCE(jr.release_text, '')), '') AS body
  FROM public.job_releases jr
  WHERE NULLIF(BTRIM(COALESCE(jr.release_text, '')), '') IS NOT NULL
  ORDER BY jr.account_id, COALESCE(jr.updated_at, jr.created_at) DESC, jr.id DESC
)
UPDATE public.document_templates dt
SET
  body = COALESCE(
    CASE
      WHEN dt.system_key = 'job_agreement' THEN lja.body
      WHEN dt.system_key = 'warranty_agreement' THEN lw.body
      WHEN dt.system_key = 'job_release' THEN ljr.body
      ELSE dt.body
    END,
    dt.body
  ),
  updated_at = now()
FROM latest_job_agreement lja
FULL OUTER JOIN latest_warranty lw
  ON lw.account_id = lja.account_id
FULL OUTER JOIN latest_job_release ljr
  ON ljr.account_id = COALESCE(lja.account_id, lw.account_id)
WHERE dt.account_id = COALESCE(lja.account_id, lw.account_id, ljr.account_id)
  AND dt.system_key IN ('job_agreement', 'warranty_agreement', 'job_release')
  AND NULLIF(BTRIM(COALESCE(dt.body, '')), '') IS NULL
  AND (
    (dt.system_key = 'job_agreement' AND lja.body IS NOT NULL)
    OR (dt.system_key = 'warranty_agreement' AND lw.body IS NOT NULL)
    OR (dt.system_key = 'job_release' AND ljr.body IS NOT NULL)
  );

