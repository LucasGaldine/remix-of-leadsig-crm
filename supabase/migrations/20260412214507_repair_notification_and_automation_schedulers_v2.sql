-- Backfill missing notification preferences so digest/email logic has required keys.
UPDATE public.profiles
SET notification_preferences =
  COALESCE(notification_preferences, '{}'::jsonb)
  || jsonb_build_object(
    'channels', COALESCE(notification_preferences->'channels', '{"push": false, "email": true, "sms": false}'::jsonb),
    'alerts', COALESCE(notification_preferences->'alerts', '{"new_leads": true, "lead_updates": false, "payments": true, "schedule_changes": true, "tasks": false, "job_assignments": false, "same_day_reminders": false}'::jsonb),
    'email_events', COALESCE(notification_preferences->'email_events', '{"estimate_approved": true, "invoice_sent": true, "payment_logged": true}'::jsonb),
    'quiet_hours', COALESCE(notification_preferences->'quiet_hours', '{"enabled": false, "start": "21:00", "end": "07:00"}'::jsonb),
    'digest', COALESCE(notification_preferences->'digest', '{"frequency": "daily"}'::jsonb)
  )
WHERE notification_preferences IS NULL
   OR notification_preferences->'channels' IS NULL
   OR notification_preferences->'digest' IS NULL
   OR notification_preferences->'email_events' IS NULL;

-- Ensure account automation settings have payment_emails defaults present.
UPDATE public.accounts
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object(
    'job_message_automation',
      COALESCE(settings->'job_message_automation', '{}'::jsonb)
      || jsonb_build_object(
        'payment_emails',
        COALESCE(settings->'job_message_automation'->'payment_emails', '{"estimate_approved": true, "invoice_sent": true, "payment_logged": true}'::jsonb)
      )
  )
WHERE settings->'job_message_automation'->'payment_emails' IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  _supabase_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
  _job_id bigint;
BEGIN
  SELECT jobid INTO _job_id FROM cron.job WHERE jobname = 'send-email-digest-daily' LIMIT 1;
  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;

  PERFORM cron.schedule(
    'send-email-digest-daily',
    '0 8 * * *',
    format(
      $cron$
      SELECT extensions.http_post(
        '%s/functions/v1/send-email-digest',
        '{}',
        'application/json',
        ARRAY[
          extensions.http_header('Authorization', 'Bearer %s'),
          extensions.http_header('apikey', '%s'),
          extensions.http_header('Content-Type', 'application/json')
        ]
      );
      $cron$,
      _supabase_url,
      _anon_jwt,
      _anon_jwt
    )
  );

  SELECT jobid INTO _job_id FROM cron.job WHERE jobname = 'dispatch-job-message-automation-every-minute' LIMIT 1;
  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;

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
          extensions.http_header('apikey', '%s'),
          extensions.http_header('Content-Type', 'application/json')
        ]
      );
      $cron$,
      _supabase_url,
      _anon_jwt,
      _anon_jwt
    )
  );
END $$;;
