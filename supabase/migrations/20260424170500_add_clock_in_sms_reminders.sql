/*
  # Add clock-in SMS reminders

  1. Adds `dispatch_clock_in_sms_reminders()` dispatcher function
     - Runs every minute via pg_cron
     - Finds schedule windows that are 15 minutes before start
     - Sends one SMS per assigned user through `send-sms`
     - Deduplicates by checking `sms_notification_log` for sent records

  2. Adds cron schedule `dispatch-clock-in-reminders-every-minute`
*/

CREATE OR REPLACE FUNCTION public.dispatch_clock_in_sms_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _app_base_url text;
  _now timestamptz := now();
  _rec record;
BEGIN
  SELECT decrypted_secret INTO _supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  IF _supabase_url IS NULL THEN
    SELECT current_setting('app.settings.supabase_url', true) INTO _supabase_url;
  END IF;

  IF _supabase_url IS NULL THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _app_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'app_url'
  LIMIT 1;

  IF _app_base_url IS NULL THEN
    SELECT current_setting('app.settings.app_url', true) INTO _app_base_url;
  END IF;

  IF _app_base_url IS NULL OR trim(_app_base_url) = '' THEN
    _app_base_url := 'https://app.leadsig.com';
  END IF;

  _app_base_url := regexp_replace(trim(_app_base_url), '/+$', '');

  FOR _rec IN
    WITH due_schedules AS (
      SELECT
        js.id AS job_schedule_id,
        js.account_id,
        js.lead_id,
        js.scheduled_date,
        js.scheduled_time_start,
        l.name AS lead_name,
        (
          make_timestamptz(
            EXTRACT(YEAR FROM js.scheduled_date)::int,
            EXTRACT(MONTH FROM js.scheduled_date)::int,
            EXTRACT(DAY FROM js.scheduled_date)::int,
            EXTRACT(HOUR FROM js.scheduled_time_start)::int,
            EXTRACT(MINUTE FROM js.scheduled_time_start)::int,
            0,
            'UTC'
          )
        ) AS schedule_start_at
      FROM public.job_schedules js
      JOIN public.leads l
        ON l.id = js.lead_id
       AND l.account_id = js.account_id
      WHERE js.scheduled_date IS NOT NULL
        AND js.scheduled_time_start IS NOT NULL
        AND COALESCE(js.is_completed, false) = false
    ),
    due_users AS (
      SELECT DISTINCT
        ds.job_schedule_id,
        ds.account_id,
        ds.lead_id,
        ds.scheduled_date,
        ds.scheduled_time_start,
        ds.lead_name,
        ds.schedule_start_at,
        ja.user_id
      FROM due_schedules ds
      JOIN public.job_assignments ja
        ON ja.lead_id = ds.lead_id
       AND ja.user_id IS NOT NULL
       AND (ja.job_schedule_id = ds.job_schedule_id OR ja.job_schedule_id IS NULL)
      WHERE (ds.schedule_start_at - interval '15 minutes') <= _now
        AND (ds.schedule_start_at - interval '15 minutes') > (_now - interval '5 minutes')
    )
    SELECT du.*
    FROM due_users du
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.sms_notification_log log
      WHERE log.account_id = du.account_id
        AND log.event_type = 'clock_in_reminders'
        AND log.status = 'sent'
        AND log.metadata ->> 'job_schedule_id' = du.job_schedule_id::text
        AND log.metadata ->> 'user_id' = du.user_id::text
    )
  LOOP
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/send-sms',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'event_type', 'clock_in_reminders',
        'account_id', _rec.account_id::text,
        'data', jsonb_build_object(
          'lead_id', _rec.lead_id::text,
          'lead_name', COALESCE(_rec.lead_name, 'Job'),
          'user_id', _rec.user_id::text,
          'job_schedule_id', _rec.job_schedule_id::text,
          'scheduled_date', _rec.scheduled_date::text,
          'scheduled_time_start', _rec.scheduled_time_start::text,
          'job_url', _app_base_url || '/jobs/' || _rec.lead_id::text
        )
      )
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-clock-in-reminders-every-minute');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'dispatch-clock-in-reminders-every-minute',
  '* * * * *',
  'SELECT public.dispatch_clock_in_sms_reminders();'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'dispatch-clock-in-reminders-every-minute'
);
