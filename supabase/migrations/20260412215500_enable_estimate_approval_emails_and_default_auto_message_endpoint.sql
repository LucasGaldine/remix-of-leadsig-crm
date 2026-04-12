/*
  # Enable Immediate Estimate Approval Emails + Default Auto Message Endpoint

  1. Creates estimate_email_notifications_log for idempotent email delivery logs
  2. Adds trigger on estimates.status accepted transition to call
     send-estimate-approval-notifications edge function
  3. Sets default built-in auto-message endpoint for accounts that have
     job_message_automation enabled but no endpoint URL
  4. Adds overload for render_job_message_template to accept unified_status
*/

CREATE TABLE IF NOT EXISTS public.estimate_email_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type = ANY (ARRAY['customer', 'user'])),
  status text NOT NULL CHECK (status = ANY (ARRAY['sent', 'failed'])),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_email_notifications_log_estimate
  ON public.estimate_email_notifications_log (estimate_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_email_notifications_unique_sent
  ON public.estimate_email_notifications_log (estimate_id, recipient_email, recipient_type)
  WHERE status = 'sent';

ALTER TABLE public.estimate_email_notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view estimate email notifications" ON public.estimate_email_notifications_log;
CREATE POLICY "Account members can view estimate email notifications"
  ON public.estimate_email_notifications_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_email_notifications_log.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

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

  PERFORM extensions.http_post(
    _project_url || '/functions/v1/send-estimate-approval-notifications',
    json_build_object('estimate_id', NEW.id)::text,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || _anon_jwt),
      extensions.http_header('apikey', _anon_jwt),
      extensions.http_header('Content-Type', 'application/json')
    ]
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_estimate_approval_notifications ON public.estimates;
CREATE TRIGGER trigger_dispatch_estimate_approval_notifications
  AFTER UPDATE OF status ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_estimate_approval_notifications();

UPDATE public.accounts
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object(
    'job_message_automation',
      COALESCE(settings->'job_message_automation', '{}'::jsonb)
      || jsonb_build_object(
        'endpoint',
          COALESCE(settings->'job_message_automation'->'endpoint', '{}'::jsonb)
          || jsonb_build_object(
            'enabled', true,
            'url', COALESCE(NULLIF(settings->'job_message_automation'->'endpoint'->>'url', ''), 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-job-automation-message'),
            'auth_header_name', COALESCE(settings->'job_message_automation'->'endpoint'->>'auth_header_name', ''),
            'auth_header_value', COALESCE(settings->'job_message_automation'->'endpoint'->>'auth_header_value', '')
          )
      )
  )
WHERE COALESCE((settings->'job_message_automation'->>'enabled')::boolean, false) = true
  AND COALESCE(NULLIF(settings->'job_message_automation'->'endpoint'->>'url', ''), '') = '';

CREATE OR REPLACE FUNCTION public.render_job_message_template(
  template_text text,
  lead_name text,
  service_type text,
  lead_status public.unified_status,
  lead_id uuid,
  scheduled_date_text text,
  scheduled_time_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.render_job_message_template(
    template_text,
    lead_name,
    service_type,
    lead_status::text,
    lead_id,
    scheduled_date_text,
    scheduled_time_text
  );
$$;
