/*
  # Fix SMS triggers to use project URL directly

  1. Changes
    - Hard-code the Supabase project URL in trigger functions
    - The URL is public information (same as VITE_SUPABASE_URL in frontend)
    - No vault access needed, avoiding permission issues

  2. Notes
    - send-sms edge function has verify_jwt=false
    - Trigger functions use SECURITY DEFINER for proper access
    - pg_net makes async HTTP calls that don't block transactions
*/

CREATE OR REPLACE FUNCTION notify_sms_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_lead_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _customer_name text;
BEGIN
  SELECT name INTO _customer_name FROM customers WHERE id = NEW.customer_id;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_sms_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
  RETURN NEW;
END;
$$;
