/*
  # Fix mutable search_path on functions and revoke excess EXECUTE grants

  1. Search Path Fixes (SET search_path = '')
    - `render_job_message_template` (3 overloads)
    - `set_elo_growth_signup_normalized_email`
    - `is_mock_profile_in_account`
    - `compute_job_message_scheduled_for`
    - `is_lead_fully_paid`
    - `generate_affiliate_referral_code`
    - `set_estimate_versions_updated_at`
    - `notify_sms_job_assignment`
    - `check_assignment_overlap`
    - `check_mock_assignment_overlap`

  2. Revoke EXECUTE from authenticated on server-only functions
    - `check_assignment_overlap` (only called from edge functions via service_role)
    - `check_mock_assignment_overlap` (only called from edge functions via service_role)

  3. Important notes
    - Functions that reference public schema tables use fully qualified names (public.table)
    - Trigger functions execute in table owner context so revoke from authenticated is safe
    - RLS helper functions (is_account_member etc) intentionally retain authenticated access
    - get_account_by_invite_code and get_public_site intentionally retain anon access
*/

-- =============================================================
-- render_job_message_template (5-arg overload)
-- =============================================================
CREATE OR REPLACE FUNCTION public.render_job_message_template(template_text text, lead_name text, service_type text, scheduled_date_text text, scheduled_time_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = ''
AS $function$
  SELECT trim(
    replace(
      replace(
        replace(
          replace(COALESCE(template_text, ''), '{{job_name}}', COALESCE(lead_name, '')),
          '{{service_type}}',
          COALESCE(service_type, '')
        ),
        '{{scheduled_date}}',
        COALESCE(scheduled_date_text, '')
      ),
      '{{scheduled_time}}',
      COALESCE(scheduled_time_text, '')
    )
  );
$function$;

-- =============================================================
-- render_job_message_template (7-arg text overload)
-- =============================================================
CREATE OR REPLACE FUNCTION public.render_job_message_template(template_text text, lead_name text, service_type text, lead_status text, lead_id uuid, scheduled_date_text text, scheduled_time_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = ''
AS $function$
  SELECT trim(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(COALESCE(template_text, ''), '{{job_name}}', COALESCE(lead_name, '')),
                    '{{client_name}}',
                    COALESCE(lead_name, '')
                  ),
                  '{{first_name}}',
                  NULLIF(split_part(COALESCE(lead_name, ''), ' ', 1), '')
                ),
                '{{service_type}}',
                COALESCE(service_type, '')
              ),
              '{{job_status}}',
              COALESCE(lead_status, '')
            ),
            '{{lead_id}}',
            COALESCE(lead_id::text, '')
          ),
          '{{scheduled_date}}',
          COALESCE(scheduled_date_text, '')
        ),
        '{{scheduled_time}}',
        COALESCE(scheduled_time_text, '')
      ),
      '{{scheduled_datetime}}',
      trim(concat_ws(' ', COALESCE(scheduled_date_text, ''), COALESCE(scheduled_time_text, '')))
    )
  );
$function$;

-- =============================================================
-- render_job_message_template (7-arg unified_status overload)
-- =============================================================
CREATE OR REPLACE FUNCTION public.render_job_message_template(template_text text, lead_name text, service_type text, lead_status public.unified_status, lead_id uuid, scheduled_date_text text, scheduled_time_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = ''
AS $function$
  SELECT public.render_job_message_template(
    template_text,
    lead_name,
    service_type,
    lead_status::text,
    lead_id,
    scheduled_date_text,
    scheduled_time_text
  );
$function$;

-- =============================================================
-- set_elo_growth_signup_normalized_email
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_elo_growth_signup_normalized_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.normalized_email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$function$;

-- =============================================================
-- is_mock_profile_in_account
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_mock_profile_in_account(p_mock_profile_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.mock_crew_profiles mcp
    WHERE mcp.id = p_mock_profile_id
    AND mcp.account_id = p_account_id
  );
$function$;

-- =============================================================
-- compute_job_message_scheduled_for
-- =============================================================
CREATE OR REPLACE FUNCTION public.compute_job_message_scheduled_for(trigger_type text, offset_minutes integer, base_ts timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  now_ts timestamptz := now();
  effective_base timestamptz := COALESCE(base_ts, now());
  scheduled_ts timestamptz;
BEGIN
  IF trigger_type = 'before_schedule_start' THEN
    scheduled_ts := effective_base - make_interval(mins => GREATEST(offset_minutes, 0));
  ELSIF trigger_type = 'after_schedule_start' THEN
    scheduled_ts := effective_base + make_interval(mins => GREATEST(offset_minutes, 0));
  ELSE
    scheduled_ts := now_ts;
  END IF;

  IF scheduled_ts < now_ts THEN
    RETURN now_ts;
  END IF;

  RETURN scheduled_ts;
END;
$function$;

-- =============================================================
-- is_lead_fully_paid
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_lead_fully_paid(p_lead_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  WITH invoice_rollup AS (
    SELECT
      COUNT(*)::int AS invoice_count,
      COALESCE(bool_and(i.status = 'paid' AND COALESCE(i.balance_due, 0) <= 0), false) AS all_paid
    FROM public.invoices i
    WHERE i.lead_id = p_lead_id
  )
  SELECT (invoice_count > 0 AND all_paid)
  FROM invoice_rollup;
$function$;

-- =============================================================
-- generate_affiliate_referral_code
-- =============================================================
CREATE OR REPLACE FUNCTION public.generate_affiliate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  v_code text;
BEGIN
  v_code := 'AFF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));
  RETURN v_code;
END;
$function$;

-- =============================================================
-- set_estimate_versions_updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_estimate_versions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- =============================================================
-- notify_sms_job_assignment
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_sms_job_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  _lead_name text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _lead_name FROM public.leads WHERE id = NEW.lead_id;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event_type', 'job_assignments',
      'account_id', NEW.account_id::text,
      'data', jsonb_build_object(
        'lead_id', NEW.lead_id::text,
        'lead_name', COALESCE(_lead_name, 'Job'),
        'user_id', NEW.user_id::text,
        'action', 'assigned'
      )
    )
  );
  RETURN NEW;
END;
$function$;

-- =============================================================
-- check_assignment_overlap
-- =============================================================
CREATE OR REPLACE FUNCTION public.check_assignment_overlap(p_user_id uuid, p_schedule_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.user_id = p_user_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$function$;

-- =============================================================
-- check_mock_assignment_overlap
-- =============================================================
CREATE OR REPLACE FUNCTION public.check_mock_assignment_overlap(p_mock_profile_id uuid, p_schedule_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_mock_profile_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.mock_crew_profile_id = p_mock_profile_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$function$;

-- =============================================================
-- Revoke EXECUTE from authenticated on server-only functions
-- (only called via service_role from edge functions)
-- =============================================================
REVOKE EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) FROM authenticated;

-- Re-grant to service_role explicitly (CREATE OR REPLACE resets default grants)
GRANT EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) TO service_role;

-- Revoke PUBLIC pseudo-role on trigger functions that were just recreated
-- (CREATE OR REPLACE grants EXECUTE to PUBLIC by default)
REVOKE ALL ON FUNCTION public.set_elo_growth_signup_normalized_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_estimate_versions_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_sms_job_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_affiliate_referral_code() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_elo_growth_signup_normalized_email() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_estimate_versions_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_sms_job_assignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_referral_code() TO service_role;

-- Ensure is_mock_profile_in_account retains correct grants after recreation
REVOKE ALL ON FUNCTION public.is_mock_profile_in_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mock_profile_in_account(uuid, uuid) TO authenticated, service_role;
