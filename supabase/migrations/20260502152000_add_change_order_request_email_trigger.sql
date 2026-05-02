/*
  # Send customer email when a change order is requested

  - Dispatches a non-blocking edge-function call when an accepted estimate
    transitions into pending change orders (has_pending_changes false/null -> true).
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_request_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
BEGIN
  IF NEW.status::text <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF NEW.has_pending_changes IS DISTINCT FROM true OR COALESCE(OLD.has_pending_changes, false) = true THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-change-order-request-email',
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
        'Change-order request email dispatch failed for estimate %: %',
        NEW.id,
        SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_change_order_request_email ON public.estimates;
CREATE TRIGGER trigger_dispatch_change_order_request_email
  AFTER UPDATE OF has_pending_changes ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_change_order_request_email();
