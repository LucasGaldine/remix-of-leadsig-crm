/*
  # Fix estimate approval notification trigger auth headers

  Problem:
  - Triggers dispatch to send-estimate-approval-notifications via net.http_post
    without Authorization/apikey headers.
  - If the edge function enforces JWT, dispatch returns unauthorized and no emails send.

  Fix:
  - Add anon JWT headers to both estimate and change-order dispatch triggers.
  - Keep non-blocking behavior with exception handling.
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_estimate_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
BEGIN
  IF NEW.status::text <> 'accepted' OR OLD.status::text = 'accepted' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-estimate-approval-notifications',
      body := jsonb_build_object('estimate_id', NEW.id),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || _anon_jwt,
        'apikey', _anon_jwt,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING
        'Estimate approval notification dispatch failed for estimate %: %',
        NEW.id,
        SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
  _estimate_status text;
BEGIN
  IF NOT (
    NEW.is_change_order = true
    AND COALESCE(OLD.change_order_approved, false) = false
    AND NEW.change_order_approved = true
  ) THEN
    RETURN NEW;
  END IF;

  SELECT e.status::text
  INTO _estimate_status
  FROM public.estimates e
  WHERE e.id = NEW.estimate_id;

  IF _estimate_status IS DISTINCT FROM 'accepted' THEN
    RETURN NEW;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext(NEW.estimate_id::text)::bigint) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-estimate-approval-notifications',
      body := jsonb_build_object(
        'estimate_id', NEW.estimate_id,
        'event_type', 'change_order_approved'
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || _anon_jwt,
        'apikey', _anon_jwt,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING
        'Change-order approval notification dispatch failed for estimate %: %',
        NEW.estimate_id,
        SQLERRM;
  END;

  RETURN NEW;
END;
$$;
