/*
  # Add job message automation pipeline

  1. New tables
    - message_automation_events
    - message_automation_delivery_log

  2. Automation behavior
    - Reads account-level `job_message_automation` config from `accounts.settings`
    - Enqueues events from `leads` and `job_schedules` triggers
    - Schedules immediate or schedule-relative delivery times

  3. Delivery scheduler
    - Adds pg_cron schedule to invoke dispatch-job-message-automation edge function every minute
*/

CREATE TABLE IF NOT EXISTS public.message_automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  job_schedule_id uuid NULL REFERENCES public.job_schedules(id) ON DELETE CASCADE,
  trigger_source text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  backoff_minutes integer NOT NULL DEFAULT 5,
  endpoint_url text NOT NULL,
  auth_header_name text NULL,
  auth_header_value text NULL,
  message_template text NOT NULL DEFAULT '',
  message_rendered text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text NULL,
  last_response_status integer NULL,
  last_response_body text NULL,
  next_retry_at timestamptz NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_automation_events_status_check CHECK (
    status = ANY (ARRAY['queued', 'processing', 'retry_pending', 'sent', 'failed'])
  )
);

CREATE INDEX IF NOT EXISTS idx_message_automation_events_due
  ON public.message_automation_events (status, scheduled_for, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_message_automation_events_account
  ON public.message_automation_events (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.message_automation_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.message_automation_events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  endpoint_url text NOT NULL,
  status_code integer NULL,
  response_body text NULL,
  error_message text NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_automation_delivery_log_event
  ON public.message_automation_delivery_log (event_id, attempted_at DESC);

ALTER TABLE public.message_automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_automation_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view message automation events" ON public.message_automation_events;
CREATE POLICY "Account members can view message automation events"
  ON public.message_automation_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = message_automation_events.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can view message automation delivery logs" ON public.message_automation_delivery_log;
CREATE POLICY "Account members can view message automation delivery logs"
  ON public.message_automation_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = message_automation_delivery_log.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.compute_job_message_scheduled_for(
  trigger_type text,
  offset_minutes integer,
  base_ts timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.render_job_message_template(
  template_text text,
  lead_name text,
  service_type text,
  scheduled_date_text text,
  scheduled_time_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.enqueue_job_message_automation_event(
  p_account_id uuid,
  p_lead_id uuid,
  p_trigger_source text,
  p_job_schedule_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config jsonb;
  selected_service_types text[];
  trigger_type text;
  offset_minutes integer;
  max_attempts integer;
  backoff_minutes integer;
  endpoint_url text;
  auth_header_name text;
  auth_header_value text;
  message_template text;
  schedule_row public.job_schedules%ROWTYPE;
  lead_row public.leads%ROWTYPE;
  base_schedule_ts timestamptz;
  scheduled_for_ts timestamptz;
  rendered_message text;
  payload jsonb;
BEGIN
  SELECT a.settings -> 'job_message_automation'
  INTO config
  FROM public.accounts a
  WHERE a.id = p_account_id;

  IF config IS NULL OR COALESCE((config ->> 'enabled')::boolean, false) = false THEN
    RETURN;
  END IF;

  SELECT *
  INTO lead_row
  FROM public.leads
  WHERE id = p_lead_id
    AND account_id = p_account_id;

  IF lead_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO selected_service_types
  FROM jsonb_array_elements_text(COALESCE(config -> 'job_service_types', '[]'::jsonb)) value;

  IF array_length(selected_service_types, 1) IS NOT NULL
     AND COALESCE(lead_row.service_type, '') <> ''
     AND NOT (lead_row.service_type = ANY(selected_service_types)) THEN
    RETURN;
  END IF;

  trigger_type := COALESCE(config #>> '{trigger,type}', 'immediate');
  offset_minutes := COALESCE((config #>> '{trigger,offset_minutes}')::integer, 0);
  max_attempts := GREATEST(COALESCE((config #>> '{retry,max_attempts}')::integer, 3), 1);
  backoff_minutes := GREATEST(COALESCE((config #>> '{retry,backoff_minutes}')::integer, 5), 0);

  endpoint_url := NULLIF(trim(COALESCE(config #>> '{endpoint,url}', '')), '');
  auth_header_name := NULLIF(trim(COALESCE(config #>> '{endpoint,auth_header_name}', '')), '');
  auth_header_value := config #>> '{endpoint,auth_header_value}';
  message_template := COALESCE(config ->> 'message_template', '');

  IF endpoint_url IS NULL THEN
    RETURN;
  END IF;

  IF p_job_schedule_id IS NOT NULL THEN
    SELECT *
    INTO schedule_row
    FROM public.job_schedules
    WHERE id = p_job_schedule_id;
  END IF;

  IF schedule_row.id IS NULL THEN
    SELECT *
    INTO schedule_row
    FROM public.job_schedules
    WHERE lead_id = p_lead_id
    ORDER BY scheduled_date ASC, scheduled_time_start ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF schedule_row.id IS NOT NULL THEN
    base_schedule_ts := make_timestamptz(
      EXTRACT(YEAR FROM schedule_row.scheduled_date)::int,
      EXTRACT(MONTH FROM schedule_row.scheduled_date)::int,
      EXTRACT(DAY FROM schedule_row.scheduled_date)::int,
      COALESCE(EXTRACT(HOUR FROM schedule_row.scheduled_time_start)::int, 9),
      COALESCE(EXTRACT(MINUTE FROM schedule_row.scheduled_time_start)::int, 0),
      0,
      'UTC'
    );
  ELSIF lead_row.scheduled_date IS NOT NULL THEN
    base_schedule_ts := make_timestamptz(
      EXTRACT(YEAR FROM lead_row.scheduled_date)::int,
      EXTRACT(MONTH FROM lead_row.scheduled_date)::int,
      EXTRACT(DAY FROM lead_row.scheduled_date)::int,
      COALESCE(EXTRACT(HOUR FROM lead_row.scheduled_time_start)::int, 9),
      COALESCE(EXTRACT(MINUTE FROM lead_row.scheduled_time_start)::int, 0),
      0,
      'UTC'
    );
  ELSE
    base_schedule_ts := now();
  END IF;

  scheduled_for_ts := public.compute_job_message_scheduled_for(trigger_type, offset_minutes, base_schedule_ts);

  rendered_message := public.render_job_message_template(
    message_template,
    lead_row.name,
    lead_row.service_type,
    COALESCE(schedule_row.scheduled_date::text, lead_row.scheduled_date::text, ''),
    COALESCE(schedule_row.scheduled_time_start::text, lead_row.scheduled_time_start::text, '')
  );

  IF rendered_message = '' THEN
    rendered_message := format('Job update for %s', COALESCE(lead_row.name, 'unnamed job'));
  END IF;

  payload := jsonb_build_object(
    'event_type', 'job_message_automation',
    'message', rendered_message,
    'account_id', p_account_id,
    'lead', jsonb_build_object(
      'id', lead_row.id,
      'name', lead_row.name,
      'service_type', lead_row.service_type,
      'status', lead_row.status,
      'scheduled_date', lead_row.scheduled_date,
      'scheduled_time_start', lead_row.scheduled_time_start,
      'scheduled_time_end', lead_row.scheduled_time_end
    ),
    'schedule', CASE
      WHEN schedule_row.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', schedule_row.id,
        'scheduled_date', schedule_row.scheduled_date,
        'scheduled_time_start', schedule_row.scheduled_time_start,
        'scheduled_time_end', schedule_row.scheduled_time_end
      )
    END,
    'trigger', jsonb_build_object(
      'source', p_trigger_source,
      'type', trigger_type,
      'offset_minutes', offset_minutes,
      'scheduled_for', scheduled_for_ts
    ),
    'generated_at', now()
  );

  INSERT INTO public.message_automation_events (
    account_id,
    lead_id,
    job_schedule_id,
    trigger_source,
    scheduled_for,
    max_attempts,
    backoff_minutes,
    endpoint_url,
    auth_header_name,
    auth_header_value,
    message_template,
    message_rendered,
    payload
  )
  VALUES (
    p_account_id,
    p_lead_id,
    schedule_row.id,
    p_trigger_source,
    scheduled_for_ts,
    max_attempts,
    backoff_minutes,
    endpoint_url,
    auth_header_name,
    auth_header_value,
    message_template,
    rendered_message,
    payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_enqueue_job_message_from_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.service_type IS NOT DISTINCT FROM OLD.service_type
    AND NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date
    AND NEW.scheduled_time_start IS NOT DISTINCT FROM OLD.scheduled_time_start
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_job_message_automation_event(
    NEW.account_id,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'lead_insert' ELSE 'lead_update' END,
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_enqueue_job_message_from_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date
    AND NEW.scheduled_time_start IS NOT DISTINCT FROM OLD.scheduled_time_start
    AND NEW.scheduled_time_end IS NOT DISTINCT FROM OLD.scheduled_time_end
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_job_message_automation_event(
    NEW.account_id,
    NEW.lead_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'job_schedule_insert' ELSE 'job_schedule_update' END,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_job_message_from_leads ON public.leads;
CREATE TRIGGER trigger_enqueue_job_message_from_leads
  AFTER INSERT OR UPDATE OF status, service_type, scheduled_date, scheduled_time_start
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enqueue_job_message_from_leads();

DROP TRIGGER IF EXISTS trigger_enqueue_job_message_from_schedules ON public.job_schedules;
CREATE TRIGGER trigger_enqueue_job_message_from_schedules
  AFTER INSERT OR UPDATE OF scheduled_date, scheduled_time_start, scheduled_time_end
  ON public.job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enqueue_job_message_from_schedules();

DO $$
DECLARE
  _supabase_url text;
  _service_role_key text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  IF _supabase_url IS NULL THEN
    SELECT current_setting('app.settings.supabase_url', true) INTO _supabase_url;
  END IF;

  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL THEN
    SELECT current_setting('app.settings.service_role_key', true) INTO _service_role_key;
  END IF;

  IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
    PERFORM cron.unschedule('dispatch-job-message-automation-every-minute');

    PERFORM cron.schedule(
      'dispatch-job-message-automation-every-minute',
      '* * * * *',
      format(
        $cron$
        SELECT extensions.http_post(
          '%s/functions/v1/dispatch-job-message-automation',
          '{}',
          'application/json',
          ARRAY[
            extensions.http_header('Authorization', 'Bearer %s'),
            extensions.http_header('Content-Type', 'application/json')
          ]
        );
        $cron$,
        _supabase_url,
        _service_role_key
      )
    );
  END IF;
END $$;
