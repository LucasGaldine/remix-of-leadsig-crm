/*
  # Ensure change-order request emails dispatch when change-order items are created

  Problem:
  - Existing dispatch depends on estimates.has_pending_changes transitioning false/null -> true.
  - If has_pending_changes is already true, no email is dispatched for new change-order requests.

  Fix:
  - Add a trigger on estimate_line_items that dispatches change-order request email when
    a pending change-order item is inserted or updated to pending.
  - Use advisory lock to avoid duplicate dispatches within the same transaction.
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
  _estimate_status text;
  _has_pending_changes boolean;
BEGIN
  IF NOT (
    NEW.is_change_order = true
    AND COALESCE(NEW.change_order_approved, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (
      COALESCE(OLD.is_change_order, false) = true
      AND COALESCE(OLD.change_order_approved, false) = false
      AND COALESCE(OLD.change_order_type::text, '') = COALESCE(NEW.change_order_type::text, '')
      AND COALESCE(OLD.name, '') = COALESCE(NEW.name, '')
      AND COALESCE(OLD.description, '') = COALESCE(NEW.description, '')
      AND COALESCE(OLD.quantity, 0) = COALESCE(NEW.quantity, 0)
      AND COALESCE(OLD.unit, '') = COALESCE(NEW.unit, '')
      AND COALESCE(OLD.unit_price, 0) = COALESCE(NEW.unit_price, 0)
      AND COALESCE(OLD.total, 0) = COALESCE(NEW.total, 0)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT e.status::text, COALESCE(e.has_pending_changes, false)
  INTO _estimate_status, _has_pending_changes
  FROM public.estimates e
  WHERE e.id = NEW.estimate_id;

  IF _estimate_status IS DISTINCT FROM 'accepted' OR _has_pending_changes IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext(NEW.estimate_id::text)::bigint) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-change-order-request-email',
      body := jsonb_build_object('estimate_id', NEW.estimate_id),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || _anon_jwt,
        'apikey', _anon_jwt,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING
        'Change-order request email dispatch (line items) failed for estimate %: %',
        NEW.estimate_id,
        SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_change_order_request_email_from_line_items ON public.estimate_line_items;
CREATE TRIGGER trigger_dispatch_change_order_request_email_from_line_items
  AFTER INSERT OR UPDATE OF is_change_order, change_order_approved, change_order_type, name, description, quantity, unit, unit_price, total
  ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items();
