/*
  # Fix document template merge-field resolver scope source

  The previous resolver referenced leads.scope_of_work_items, which is not
  part of the live schema. Resolve scope from checklist items first, then
  estimate line items, then the lead description.
*/

CREATE OR REPLACE FUNCTION public.resolve_document_template_merge_fields(
  p_account_id uuid,
  p_lead_id uuid,
  p_estimate_id uuid DEFAULT NULL,
  p_scope_of_work_override text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_lead record;
  v_customer record;
  v_account record;
  v_estimate record;
  v_scope_of_work text := '';
  v_job_address text := '';
  v_service_type text := '';
  v_default_schedule jsonb := '{}'::jsonb;
  v_deposit numeric := 33;
  v_midpoint numeric := 33;
  v_final numeric := 34;
  v_deposit_text text := '33';
  v_midpoint_text text := '33';
  v_final_text text := '34';
  v_default_schedule_summary text := 'Deposit 33%, Midpoint 33%, Final 34%';
BEGIN
  IF p_account_id IS NULL OR p_lead_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT
    l.id,
    l.account_id,
    l.customer_id,
    l.name,
    l.address,
    l.city,
    l.service_type,
    l.description
  INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id
    AND l.account_id = p_account_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT
    a.id,
    a.company_name,
    a.company_email,
    a.company_phone,
    a.settings
  INTO v_account
  FROM public.accounts a
  WHERE a.id = p_account_id
  LIMIT 1;

  IF v_lead.customer_id IS NOT NULL THEN
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_lead.customer_id
      AND c.account_id = p_account_id
    LIMIT 1;
  END IF;

  IF p_estimate_id IS NOT NULL THEN
    SELECT
      e.id,
      e.account_id,
      e.job_id,
      e.subtotal,
      e.tax,
      e.discount,
      e.total,
      e.updated_at
    INTO v_estimate
    FROM public.estimates e
    WHERE e.id = p_estimate_id
      AND e.account_id = p_account_id
    LIMIT 1;
  ELSE
    SELECT
      e.id,
      e.account_id,
      e.job_id,
      e.subtotal,
      e.tax,
      e.discount,
      e.total,
      e.updated_at
    INTO v_estimate
    FROM public.estimates e
    WHERE e.account_id = p_account_id
      AND e.job_id = p_lead_id
    ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_job_address := concat_ws(', ', NULLIF(btrim(COALESCE(v_lead.address, '')), ''), NULLIF(btrim(COALESCE(v_lead.city, '')), ''));
  v_service_type := NULLIF(btrim(COALESCE(v_lead.service_type, '')), '');

  IF NULLIF(btrim(COALESCE(p_scope_of_work_override, '')), '') IS NOT NULL THEN
    v_scope_of_work := btrim(p_scope_of_work_override);
  END IF;

  IF v_scope_of_work = '' THEN
    SELECT COALESCE(
      string_agg(format('%s. %s', checklist_rows.row_number, checklist_rows.label), E'\n' ORDER BY checklist_rows.row_number),
      ''
    )
    INTO v_scope_of_work
    FROM (
      SELECT
        row_number() OVER (ORDER BY COALESCE(jci.sort_order, 0), jci.created_at, jci.id) AS row_number,
        btrim(COALESCE(jci.label, '')) AS label
      FROM public.job_checklist_items jci
      WHERE jci.job_id = p_lead_id
    ) AS checklist_rows
    WHERE checklist_rows.label <> '';
  END IF;

  IF v_scope_of_work = '' AND v_estimate.id IS NOT NULL THEN
    SELECT COALESCE(
      string_agg(format('%s. %s', line_rows.row_number, line_rows.line_text), E'\n' ORDER BY line_rows.row_number),
      ''
    )
    INTO v_scope_of_work
    FROM (
      SELECT
        row_number() OVER (ORDER BY COALESCE(li.sort_order, 0), li.created_at, li.id) AS row_number,
        btrim(
          concat_ws(
            ': ',
            NULLIF(btrim(COALESCE(li.name, '')), ''),
            NULLIF(btrim(COALESCE(li.description, '')), '')
          )
        ) AS line_text
      FROM public.estimate_line_items li
      WHERE li.estimate_id = v_estimate.id
        AND (COALESCE(li.is_change_order, false) = false OR COALESCE(li.change_order_approved, false) = true)
    ) AS line_rows
    WHERE line_rows.line_text <> '';
  END IF;

  IF v_scope_of_work = '' THEN
    v_scope_of_work := btrim(COALESCE(v_lead.description, ''));
  END IF;

  IF v_account.settings IS NOT NULL
    AND jsonb_typeof(v_account.settings) = 'object'
    AND jsonb_typeof(v_account.settings -> 'default_payment_schedule') = 'object'
  THEN
    v_default_schedule := v_account.settings -> 'default_payment_schedule';
  END IF;

  IF COALESCE(v_default_schedule ->> 'deposit_percentage', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
    v_deposit := GREATEST((v_default_schedule ->> 'deposit_percentage')::numeric, 0);
  END IF;
  IF COALESCE(v_default_schedule ->> 'midpoint_percentage', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
    v_midpoint := GREATEST((v_default_schedule ->> 'midpoint_percentage')::numeric, 0);
  END IF;
  IF COALESCE(v_default_schedule ->> 'final_percentage', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
    v_final := GREATEST((v_default_schedule ->> 'final_percentage')::numeric, 0);
  END IF;

  v_deposit_text := trim(trailing '.' FROM trim(trailing '0' FROM to_char(v_deposit, 'FM999999990.00')));
  v_midpoint_text := trim(trailing '.' FROM trim(trailing '0' FROM to_char(v_midpoint, 'FM999999990.00')));
  v_final_text := trim(trailing '.' FROM trim(trailing '0' FROM to_char(v_final, 'FM999999990.00')));
  v_default_schedule_summary := format(
    'Deposit %s%%, Midpoint %s%%, Final %s%%',
    v_deposit_text,
    v_midpoint_text,
    v_final_text
  );

  RETURN jsonb_build_object(
    'current_date', to_char(CURRENT_DATE, 'YYYY-MM-DD'),
    'job_name', COALESCE(NULLIF(btrim(COALESCE(v_lead.name, '')), ''), ''),
    'job_address', COALESCE(v_job_address, ''),
    'service_type', COALESCE(v_service_type, 'Other'),
    'client_name', COALESCE(NULLIF(btrim(COALESCE(v_customer.name, '')), ''), ''),
    'client_email', COALESCE(NULLIF(btrim(COALESCE(v_customer.email, '')), ''), ''),
    'client_phone', COALESCE(NULLIF(btrim(COALESCE(v_customer.phone, '')), ''), ''),
    'company_name', COALESCE(NULLIF(btrim(COALESCE(v_account.company_name, '')), ''), ''),
    'company_email', COALESCE(NULLIF(btrim(COALESCE(v_account.company_email, '')), ''), ''),
    'company_phone', COALESCE(NULLIF(btrim(COALESCE(v_account.company_phone, '')), ''), 'Company phone number not provided'),
    'estimate_total',
      CASE
        WHEN v_estimate.id IS NULL THEN ''
        ELSE '$' || to_char(COALESCE(v_estimate.total, 0)::numeric, 'FM999,999,999,990.00')
      END,
    'estimate_subtotal',
      CASE
        WHEN v_estimate.id IS NULL THEN ''
        ELSE '$' || to_char(COALESCE(v_estimate.subtotal, 0)::numeric, 'FM999,999,999,990.00')
      END,
    'estimate_tax',
      CASE
        WHEN v_estimate.id IS NULL THEN ''
        ELSE '$' || to_char(COALESCE(v_estimate.tax, 0)::numeric, 'FM999,999,999,990.00')
      END,
    'estimate_discount',
      CASE
        WHEN v_estimate.id IS NULL THEN ''
        ELSE '$' || to_char(COALESCE(v_estimate.discount, 0)::numeric, 'FM999,999,999,990.00')
      END,
    'default_payment_schedule', COALESCE(v_default_schedule_summary, ''),
    'default_payment_deposit_percentage', COALESCE(v_deposit_text, ''),
    'default_payment_midpoint_percentage', COALESCE(v_midpoint_text, ''),
    'default_payment_final_percentage', COALESCE(v_final_text, ''),
    'scope_of_work', COALESCE(v_scope_of_work, '')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_document_template_merge_fields(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_document_template_merge_fields(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_document_template_merge_fields(uuid, uuid, uuid, text) TO service_role;
