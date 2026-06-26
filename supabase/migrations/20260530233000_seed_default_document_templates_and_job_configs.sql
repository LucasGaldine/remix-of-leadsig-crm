/*
  Ensure default document templates and per-job document configs are created automatically.

  Why:
  - The original document template migration backfilled existing rows only.
  - New accounts/leads created after that migration can miss defaults.
  - UI-side fallback is not a reliable source of truth.
*/

CREATE OR REPLACE FUNCTION public.seed_default_document_templates_for_account(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

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
  VALUES
    (
      p_account_id,
      'Job Agreement',
      'job-agreement',
      'job_agreement',
      trim($md$
**Date:** [[current_date]]

## Client
**Name:** [[client_name]]
**Project:** [[job_name]]
**Service Type:** [[service_type]]
**Project Address:** [[job_address]]

## Contractor
**Company:** [[company_name]]
**Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
**Subtotal:** [[estimate_subtotal]]
**Tax:** [[estimate_tax]]
**Discount:** [[estimate_discount]]
**Total:** [[estimate_total]]

## Default Payment Schedule
**Schedule:** [[default_payment_schedule]]
**Deposit:** [[default_payment_deposit_percentage]]%
**Midpoint:** [[default_payment_midpoint_percentage]]%
**Final Payment:** [[default_payment_final_percentage]]%

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
$md$),
      true,
      'on_estimate_approval',
      true,
      NULL
    ),
    (
      p_account_id,
      'Warranty',
      'warranty',
      'warranty_agreement',
      trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Covered Scope
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
$md$),
      true,
      'on_estimate_approval',
      true,
      NULL
    ),
    (
      p_account_id,
      'Job Release',
      'job-release',
      'job_release',
      trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Completed Scope
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
$md$),
      true,
      'on_job_completion',
      true,
      NULL
    )
  ON CONFLICT (account_id, slug) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_job_document_configs_for_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN;
  END IF;

  SELECT l.account_id INTO v_account_id
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_account_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.seed_default_document_templates_for_account(v_account_id);

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
    p_lead_id,
    v_account_id,
    dt.id,
    dt.default_included_in_jobs,
    dt.default_email_timing,
    dt.default_requires_signature,
    row_number() OVER (ORDER BY dt.name) - 1,
    NULL
  FROM public.document_templates dt
  WHERE dt.account_id = v_account_id
    AND dt.default_included_in_jobs = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_document_configs cfg
      WHERE cfg.lead_id = p_lead_id
        AND cfg.template_id = dt.id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.accounts_seed_default_document_templates_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_document_templates_for_account(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.leads_seed_default_job_document_configs_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_job_document_configs_for_lead(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_seed_default_document_templates ON public.accounts;
CREATE TRIGGER trg_accounts_seed_default_document_templates
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.accounts_seed_default_document_templates_tg();

DROP TRIGGER IF EXISTS trg_leads_seed_default_job_document_configs ON public.leads;
CREATE TRIGGER trg_leads_seed_default_job_document_configs
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_seed_default_job_document_configs_tg();

-- Backfill any accounts created after the original template migration.
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
  a.id,
  seed.name,
  seed.slug,
  seed.system_key,
  seed.body,
  true,
  seed.default_email_timing,
  true,
  NULL
FROM public.accounts a
CROSS JOIN (
  VALUES
    (
      'Job Agreement'::text,
      'job-agreement'::text,
      'job_agreement'::text,
      trim($md$
**Date:** [[current_date]]

## Client
**Name:** [[client_name]]
**Project:** [[job_name]]
**Service Type:** [[service_type]]
**Project Address:** [[job_address]]

## Contractor
**Company:** [[company_name]]
**Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
**Subtotal:** [[estimate_subtotal]]
**Tax:** [[estimate_tax]]
**Discount:** [[estimate_discount]]
**Total:** [[estimate_total]]

## Default Payment Schedule
**Schedule:** [[default_payment_schedule]]
**Deposit:** [[default_payment_deposit_percentage]]%
**Midpoint:** [[default_payment_midpoint_percentage]]%
**Final Payment:** [[default_payment_final_percentage]]%

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
$md$)::text,
      'on_estimate_approval'::text
    ),
    (
      'Warranty'::text,
      'warranty'::text,
      'warranty_agreement'::text,
      trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Covered Scope
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
$md$)::text,
      'on_estimate_approval'::text
    ),
    (
      'Job Release'::text,
      'job-release'::text,
      'job_release'::text,
      trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Completed Scope
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
$md$)::text,
      'on_job_completion'::text
    )
) AS seed(name, slug, system_key, body, default_email_timing)
ON CONFLICT (account_id, slug) DO NOTHING;

-- Repair any system templates that still have blank bodies.
UPDATE public.document_templates
SET
  body = trim($md$
**Date:** [[current_date]]

## Client
**Name:** [[client_name]]
**Project:** [[job_name]]
**Service Type:** [[service_type]]
**Project Address:** [[job_address]]

## Contractor
**Company:** [[company_name]]
**Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
**Subtotal:** [[estimate_subtotal]]
**Tax:** [[estimate_tax]]
**Discount:** [[estimate_discount]]
**Total:** [[estimate_total]]

## Default Payment Schedule
**Schedule:** [[default_payment_schedule]]
**Deposit:** [[default_payment_deposit_percentage]]%
**Midpoint:** [[default_payment_midpoint_percentage]]%
**Final Payment:** [[default_payment_final_percentage]]%

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
$md$),
  updated_at = now()
WHERE system_key = 'job_agreement'
  AND btrim(coalesce(body, '')) = '';

UPDATE public.document_templates
SET
  body = trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Covered Scope
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
$md$),
  updated_at = now()
WHERE system_key = 'warranty_agreement'
  AND btrim(coalesce(body, '')) = '';

UPDATE public.document_templates
SET
  body = trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Completed Scope
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
$md$),
  updated_at = now()
WHERE system_key = 'job_release'
  AND btrim(coalesce(body, '')) = '';

-- Backfill any leads missing default config rows.
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
  l.id,
  l.account_id,
  dt.id,
  dt.default_included_in_jobs,
  dt.default_email_timing,
  dt.default_requires_signature,
  row_number() OVER (PARTITION BY l.id ORDER BY dt.name) - 1,
  NULL
FROM public.leads l
JOIN public.document_templates dt
  ON dt.account_id = l.account_id
  AND dt.default_included_in_jobs = true
LEFT JOIN public.job_document_configs cfg
  ON cfg.lead_id = l.id
 AND cfg.template_id = dt.id
WHERE cfg.id IS NULL;
