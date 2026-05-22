/*
  # Prefer long-form agreement bodies for system templates

  Problem:
  Some accounts have short approval blurbs in estimates.agreement_templates that can
  overwrite richer long-form agreement content when selecting the "latest" estimate.

  Fix:
  For Job Agreement and Warranty system templates, backfill from the longest
  non-placeholder estimate agreement text per account, and only replace template
  bodies that look short/placeholder-like.
*/

WITH job_agreement_candidates AS (
  SELECT
    l.account_id,
    NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '') AS body,
    ROW_NUMBER() OVER (
      PARTITION BY l.account_id
      ORDER BY LENGTH(NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '')) DESC,
               COALESCE(e.updated_at, e.created_at) DESC,
               e.id DESC
    ) AS rn
  FROM public.estimates e
  JOIN public.leads l
    ON l.id = e.job_id
  WHERE NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '') IS NOT NULL
    AND LENGTH(NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'job_agreement', '')), '')) >= 400
    AND COALESCE(e.agreement_templates ->> 'job_agreement', '') !~* '^By approving this estimate'
),
warranty_candidates AS (
  SELECT
    l.account_id,
    NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '') AS body,
    ROW_NUMBER() OVER (
      PARTITION BY l.account_id
      ORDER BY LENGTH(NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '')) DESC,
               COALESCE(e.updated_at, e.created_at) DESC,
               e.id DESC
    ) AS rn
  FROM public.estimates e
  JOIN public.leads l
    ON l.id = e.job_id
  WHERE NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '') IS NOT NULL
    AND LENGTH(NULLIF(BTRIM(COALESCE(e.agreement_templates ->> 'warranty_agreement', '')), '')) >= 300
    AND COALESCE(e.agreement_templates ->> 'warranty_agreement', '') !~* '^By approving this estimate'
)
UPDATE public.document_templates dt
SET
  body = CASE
    WHEN dt.system_key = 'job_agreement' THEN jac.body
    WHEN dt.system_key = 'warranty_agreement' THEN wc.body
    ELSE dt.body
  END,
  updated_at = now()
FROM job_agreement_candidates jac
FULL OUTER JOIN warranty_candidates wc
  ON wc.account_id = jac.account_id
WHERE dt.account_id = COALESCE(jac.account_id, wc.account_id)
  AND (
    (dt.system_key = 'job_agreement' AND jac.rn = 1 AND jac.body IS NOT NULL)
    OR (dt.system_key = 'warranty_agreement' AND wc.rn = 1 AND wc.body IS NOT NULL)
  )
  AND (
    NULLIF(BTRIM(COALESCE(dt.body, '')), '') IS NULL
    OR LENGTH(BTRIM(COALESCE(dt.body, ''))) < 300
    OR COALESCE(dt.body, '') ~* '^By approving this estimate'
  );

