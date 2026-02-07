/*
  # Fix SMS notification triggers to use pg_net correctly

  1. Changes
    - Update all trigger functions to use net.http_post() from pg_net extension
    - pg_net uses jsonb for headers and body, making calls async and non-blocking
    - Triggers no longer block the original transaction

  2. Notes
    - net.http_post is async - it queues the HTTP request and returns immediately
    - This is better for triggers as it does not slow down the original INSERT/UPDATE
*/

CREATE OR REPLACE FUNCTION notify_sms_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'event_type', 'new_leads',
        'account_id', NEW.account_id::text,
        'data', jsonb_build_object(
          'lead_id', NEW.id::text,
          'name', COALESCE(NEW.name, 'Unknown'),
          'phone', COALESCE(NEW.phone, ''),
          'email', COALESCE(NEW.email, ''),
          'service_type', COALESCE(NEW.service_type, ''),
          'source', COALESCE(NEW.source, '')
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_lead_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'event_type', 'lead_updates',
        'account_id', NEW.account_id::text,
        'data', jsonb_build_object(
          'lead_id', NEW.id::text,
          'name', COALESCE(NEW.name, 'Unknown'),
          'status', NEW.status::text,
          'old_status', OLD.status::text
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _customer_name text;
BEGIN
  SELECT name INTO _customer_name FROM customers WHERE id = NEW.customer_id;

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'event_type', 'payments',
        'account_id', NEW.account_id::text,
        'data', jsonb_build_object(
          'payment_id', NEW.id::text,
          'amount', NEW.amount::text,
          'customer_name', COALESCE(_customer_name, 'Unknown'),
          'method', NEW.method::text,
          'status', NEW.status::text
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'event_type', 'schedule_changes',
        'account_id', NEW.account_id::text,
        'data', jsonb_build_object(
          'schedule_id', NEW.id::text,
          'lead_id', NEW.lead_id::text,
          'lead_name', COALESCE(_lead_name, 'Job'),
          'scheduled_date', NEW.scheduled_date::text,
          'scheduled_time_start', COALESCE(NEW.scheduled_time_start::text, ''),
          'scheduled_time_end', COALESCE(NEW.scheduled_time_end::text, '')
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
