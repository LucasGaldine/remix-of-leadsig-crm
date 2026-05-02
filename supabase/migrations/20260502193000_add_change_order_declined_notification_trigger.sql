/*
  # Send declined change-order notifications to customer + company

  - Dispatches when pending change-order rows are deleted and no pending changes remain.
  - Sends email via send-change-order-declined-notifications edge function.
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_declined_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
  _estimate_status text;
  _pending_count bigint;
BEGIN
  IF NOT (
    OLD.is_change_order = true
    AND COALESCE(OLD.change_order_approved, false) = false
  ) THEN
    RETURN OLD;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext(('decline:' || OLD.estimate_id::text))::bigint) THEN
    RETURN OLD;
  END IF;

  SELECT e.status::text
  INTO _estimate_status
  FROM public.estimates e
  WHERE e.id = OLD.estimate_id;

  IF _estimate_status IS DISTINCT FROM 'accepted' THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*)
  INTO _pending_count
  FROM public.estimate_line_items li
  WHERE li.estimate_id = OLD.estimate_id
    AND li.is_change_order = true
    AND COALESCE(li.change_order_approved, false) = false;

  IF _pending_count > 0 THEN
    RETURN OLD;
  END IF;

  -- Keep has_pending_changes in sync for downstream consumers.
  UPDATE public.estimates
  SET has_pending_changes = false,
      updated_at = now()
  WHERE id = OLD.estimate_id
    AND COALESCE(has_pending_changes, false) = true;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-change-order-declined-notifications',
      body := jsonb_build_object('estimate_id', OLD.estimate_id),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || _anon_jwt,
        'apikey', _anon_jwt,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING
        'Change-order declined notification dispatch failed for estimate %: %',
        OLD.estimate_id,
        SQLERRM;
  END;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_change_order_declined_notifications ON public.estimate_line_items;
CREATE TRIGGER trigger_dispatch_change_order_declined_notifications
  AFTER DELETE ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_change_order_declined_notifications();
