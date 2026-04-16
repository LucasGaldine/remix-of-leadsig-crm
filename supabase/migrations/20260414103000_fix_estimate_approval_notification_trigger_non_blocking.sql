/*
  # Fix estimate approval notification trigger to avoid blocking approvals

  Root cause:
  - trigger_dispatch_estimate_approval_notifications used extensions.http_header(...)
  - that function is unavailable in this project, causing estimate status updates to fail

  Fix:
  1. Replace HTTP dispatch call with net.http_post using JSON headers.
  2. Wrap dispatch in EXCEPTION handling so notification failures never block approval.
*/

CREATE OR REPLACE FUNCTION public.trigger_dispatch_estimate_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
BEGIN
  IF NEW.status::text <> 'accepted' OR OLD.status::text = 'accepted' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-estimate-approval-notifications',
      body := jsonb_build_object('estimate_id', NEW.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
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

DROP TRIGGER IF EXISTS trigger_dispatch_estimate_approval_notifications ON public.estimates;
CREATE TRIGGER trigger_dispatch_estimate_approval_notifications
  AFTER UPDATE OF status ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_estimate_approval_notifications();
