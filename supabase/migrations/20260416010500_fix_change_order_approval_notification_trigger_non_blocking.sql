/*
  # Fix change-order approval notification trigger to avoid blocking approvals

  Root cause:
  - trigger_dispatch_change_order_approval_notifications used extensions.http_post/http_header
  - extensions.http_header is unavailable in this project, causing change-order approval updates to fail

  Fix:
  1. Switch dispatch to net.http_post with JSON headers
  2. Wrap dispatch in EXCEPTION handling so notification failures do not block approvals
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
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
      headers := jsonb_build_object('Content-Type', 'application/json')
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

DROP TRIGGER IF EXISTS trigger_dispatch_change_order_approval_notifications ON public.estimate_line_items;
CREATE TRIGGER trigger_dispatch_change_order_approval_notifications
  AFTER UPDATE OF change_order_approved ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_change_order_approval_notifications();
