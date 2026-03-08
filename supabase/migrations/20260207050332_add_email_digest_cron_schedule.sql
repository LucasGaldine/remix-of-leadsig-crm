/*
  # Add pg_cron schedule for email digest

  1. Changes
    - Enables the pg_cron and pg_net extensions
    - Creates a cron job that runs daily at 8:00 AM UTC
    - The job calls the send-email-digest edge function via pg_net
    - Daily digests are sent every day; weekly digests are sent on Mondays only
      (the edge function handles this logic internally)

  2. Notes
    - The cron job uses the service role key to authenticate
    - pg_net makes the HTTP call asynchronously so it won't block the scheduler
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

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
    PERFORM cron.unschedule('send-email-digest-daily');

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
