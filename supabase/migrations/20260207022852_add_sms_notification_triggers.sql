/*
  # Add SMS notification triggers via pg_net

  1. Functions
    - `notify_sms_new_lead()` - fires on INSERT to leads table
    - `notify_sms_lead_update()` - fires on UPDATE to leads.status column
    - `notify_sms_payment()` - fires on INSERT to payments table
    - `notify_sms_schedule_change()` - fires on INSERT or UPDATE to job_schedules table

  2. Triggers
    - `trigger_sms_new_lead` on leads INSERT
    - `trigger_sms_lead_update` on leads UPDATE of status
    - `trigger_sms_payment` on payments INSERT
    - `trigger_sms_schedule_change` on job_schedules INSERT or UPDATE

  3. Notes
    - Uses pg_net to make async HTTP calls to the send-sms edge function
    - Each trigger passes event_type, account_id, and relevant data
    - The edge function handles preference checking and actual SMS delivery
*/

CREATE OR REPLACE FUNCTION notify_sms_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF _service_key IS NULL OR _service_key = '' THEN
    _service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      _supabase_url || '/functions/v1/send-sms',
      json_build_object(
        'event_type', 'new_leads',
        'account_id', NEW.account_id::text,
        'data', json_build_object(
          'lead_id', NEW.id::text,
          'name', COALESCE(NEW.name, 'Unknown'),
          'phone', COALESCE(NEW.phone, ''),
          'email', COALESCE(NEW.email, ''),
          'service_type', COALESCE(NEW.service_type, ''),
          'source', COALESCE(NEW.source, '')
        )
      )::text,
      'application/json',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || _service_key),
        extensions.http_header('Content-Type', 'application/json')
      ]
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
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF _service_key IS NULL OR _service_key = '' THEN
    _service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      _supabase_url || '/functions/v1/send-sms',
      json_build_object(
        'event_type', 'lead_updates',
        'account_id', NEW.account_id::text,
        'data', json_build_object(
          'lead_id', NEW.id::text,
          'name', COALESCE(NEW.name, 'Unknown'),
          'status', NEW.status::text,
          'old_status', OLD.status::text
        )
      )::text,
      'application/json',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || _service_key),
        extensions.http_header('Content-Type', 'application/json')
      ]
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
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
  _customer_name text;
BEGIN
  SELECT name INTO _customer_name FROM customers WHERE id = NEW.customer_id;

  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF _service_key IS NULL OR _service_key = '' THEN
    _service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      _supabase_url || '/functions/v1/send-sms',
      json_build_object(
        'event_type', 'payments',
        'account_id', NEW.account_id::text,
        'data', json_build_object(
          'payment_id', NEW.id::text,
          'amount', NEW.amount::text,
          'customer_name', COALESCE(_customer_name, 'Unknown'),
          'method', NEW.method::text,
          'status', NEW.status::text
        )
      )::text,
      'application/json',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || _service_key),
        extensions.http_header('Content-Type', 'application/json')
      ]
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
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF _service_key IS NULL OR _service_key = '' THEN
    _service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      _supabase_url || '/functions/v1/send-sms',
      json_build_object(
        'event_type', 'schedule_changes',
        'account_id', NEW.account_id::text,
        'data', json_build_object(
          'schedule_id', NEW.id::text,
          'lead_id', NEW.lead_id::text,
          'lead_name', COALESCE(_lead_name, 'Job'),
          'scheduled_date', NEW.scheduled_date::text,
          'scheduled_time_start', COALESCE(NEW.scheduled_time_start::text, ''),
          'scheduled_time_end', COALESCE(NEW.scheduled_time_end::text, '')
        )
      )::text,
      'application/json',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || _service_key),
        extensions.http_header('Content-Type', 'application/json')
      ]
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sms_new_lead ON leads;
CREATE TRIGGER trigger_sms_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_sms_new_lead();

DROP TRIGGER IF EXISTS trigger_sms_lead_update ON leads;
CREATE TRIGGER trigger_sms_lead_update
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_sms_lead_update();

DROP TRIGGER IF EXISTS trigger_sms_payment ON payments;
CREATE TRIGGER trigger_sms_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_sms_payment();

DROP TRIGGER IF EXISTS trigger_sms_schedule_change ON job_schedules;
CREATE TRIGGER trigger_sms_schedule_change
  AFTER INSERT OR UPDATE ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION notify_sms_schedule_change();
