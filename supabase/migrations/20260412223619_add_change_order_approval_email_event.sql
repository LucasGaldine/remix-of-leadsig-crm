ALTER TABLE public.estimate_email_notifications_log
  ADD COLUMN IF NOT EXISTS event_type text;

UPDATE public.estimate_email_notifications_log
SET event_type = 'estimate_approved'
WHERE event_type IS NULL;

ALTER TABLE public.estimate_email_notifications_log
  ALTER COLUMN event_type SET DEFAULT 'estimate_approved';

ALTER TABLE public.estimate_email_notifications_log
  ALTER COLUMN event_type SET NOT NULL;

DROP INDEX IF EXISTS public.idx_estimate_email_notifications_unique_sent;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_email_notifications_unique_sent
  ON public.estimate_email_notifications_log (estimate_id, recipient_email, recipient_type, event_type)
  WHERE status = 'sent';

CREATE OR REPLACE FUNCTION public.trigger_dispatch_estimate_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
BEGIN
  IF NEW.status::text <> 'accepted' OR OLD.status::text = 'accepted' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    _project_url || '/functions/v1/send-estimate-approval-notifications',
    json_build_object('estimate_id', NEW.id, 'event_type', 'estimate_approved')::text,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || _anon_jwt),
      extensions.http_header('apikey', _anon_jwt),
      extensions.http_header('Content-Type', 'application/json')
    ]
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_dispatch_change_order_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  PERFORM extensions.http_post(
    _project_url || '/functions/v1/send-estimate-approval-notifications',
    json_build_object('estimate_id', NEW.estimate_id, 'event_type', 'change_order_approved')::text,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || _anon_jwt),
      extensions.http_header('apikey', _anon_jwt),
      extensions.http_header('Content-Type', 'application/json')
    ]
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_dispatch_change_order_approval_notifications ON public.estimate_line_items;
CREATE TRIGGER trigger_dispatch_change_order_approval_notifications
AFTER UPDATE OF change_order_approved ON public.estimate_line_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dispatch_change_order_approval_notifications();;
