/*
  # Add post-payment Job Release workflow
*/

CREATE TABLE IF NOT EXISTS public.job_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_signature' CHECK (status = ANY (ARRAY['pending_signature', 'signed'])),
  release_text text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz NULL,
  signature_image_url text NULL,
  request_email_sent_at timestamptz NULL,
  signed_copy_email_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_releases_lead_id_key UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_job_releases_account_id ON public.job_releases(account_id);
CREATE INDEX IF NOT EXISTS idx_job_releases_customer_id ON public.job_releases(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_releases_status ON public.job_releases(status);

ALTER TABLE public.job_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view job releases" ON public.job_releases;
CREATE POLICY "Account members can view job releases"
  ON public.job_releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = job_releases.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.is_lead_fully_paid(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH invoice_rollup AS (
    SELECT
      COUNT(*)::int AS invoice_count,
      COALESCE(bool_and(i.status = 'paid' AND COALESCE(i.balance_due, 0) <= 0), false) AS all_paid
    FROM public.invoices i
    WHERE i.lead_id = p_lead_id
  )
  SELECT (invoice_count > 0 AND all_paid)
  FROM invoice_rollup;
$$;

CREATE OR REPLACE FUNCTION public.build_job_release_text(p_lead_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _lead record;
  _customer record;
  _account record;
  _scope text;
  _total numeric;
BEGIN
  SELECT id, name, address, city, customer_id, account_id
  INTO _lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF _lead.id IS NULL THEN
    RETURN '';
  END IF;

  SELECT name
  INTO _customer
  FROM public.customers
  WHERE id = _lead.customer_id;

  SELECT company_name, company_email, company_phone
  INTO _account
  FROM public.accounts
  WHERE id = _lead.account_id;

  SELECT string_agg((ROW_NUMBER() OVER (ORDER BY sort_order, created_at))::text || '. ' || label, E'
')
  INTO _scope
  FROM public.job_checklist_items
  WHERE job_id = _lead.id;

  SELECT COALESCE(SUM(total), 0)
  INTO _total
  FROM public.invoices
  WHERE lead_id = _lead.id;

  RETURN
'JOB RELEASE AGREEMENT

Date: ' || to_char(now()::date, 'YYYY-MM-DD') || E'

' ||
'PARTIES

' ||
'Contractor: ' || COALESCE(_account.company_name, 'Contractor') || E'
' ||
'Address: Address on file
' ||
'Phone: ' || COALESCE(_account.company_phone, 'N/A') || E'
' ||
'Email: ' || COALESCE(_account.company_email, 'N/A') || E'

' ||
'Client: ' || COALESCE(_customer.name, 'Client') || E'
' ||
'Project Name: ' || COALESCE(_lead.name, 'Project') || E'
' ||
'Project Address: ' || COALESCE(_lead.address, '') || CASE WHEN COALESCE(_lead.city, '') <> '' THEN ', ' || _lead.city ELSE '' END || E'

' ||
'FINAL JOB RELEASE

' ||
'This Job Release Agreement is being issued after completion of the project listed above.

' ||
'By signing this agreement, the Client confirms that ' || COALESCE(_account.company_name, 'the Contractor') || ' has completed the agreed-upon work, that the completed work has been reviewed, and that the Client accepts the project as complete.

' ||
'The purpose of this agreement is to confirm that the Contractor has fulfilled the agreed scope of work and that no further work, corrections, changes, or claims are being requested by the Client at this time, except for any written warranty obligations separately provided by the Contractor.

' ||
'COMPLETED PROJECT SCOPE

' ||
'The following scope of work was completed:

' || COALESCE(_scope, '1. Scope details to be finalized in writing.') || E'

' ||
'The Contractor confirms that the work was completed in a professional and workmanlike manner.

' ||
'The Client confirms that they have had the opportunity to inspect the completed work and that the work has been completed to their satisfaction.

' ||
'PAYMENT CONFIRMATION

' ||
'Total Project Cost: $' || to_char(COALESCE(_total, 0), 'FM999,999,999,990.00') || E'

' ||
'The Client confirms that all payments due for the project have been received by the Contractor.

' ||
'No remaining balance is due unless otherwise agreed to in writing by both parties.

' ||
'CLIENT ACCEPTANCE

' ||
'By signing this agreement, the Client acknowledges and agrees that:

' ||
'The agreed scope of work has been completed.
' ||
'The Client has reviewed the completed work.
' ||
'The completed work is accepted as satisfactory.
' ||
'All project payments have been made.
' ||
'No additional work, corrections, or changes are being requested at this time.
' ||
'This agreement does not waive any written warranty provided by the Contractor.

' ||
'RELEASE OF PROJECT

' ||
'The Client releases ' || COALESCE(_account.company_name, 'the Contractor') || ' from any further obligation related to the completed project, except for obligations specifically covered under a written warranty or separate written agreement.

' ||
'This release confirms that the project is considered complete and closed as of the date signed below.';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_job_release_for_paid_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead record;
  _release_id uuid;
  _project_url text := 'https://knjbakdhjspftwqrzzcl.supabase.co';
  _anon_jwt text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJha2RoanNwZnR3cXJ6emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjg4MzEsImV4cCI6MjA4NDAwNDgzMX0.b1nFO9xOJr7th9LGyb1UdEsD5db7Y0FVrj1BdADydek';
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, account_id, customer_id, status
  INTO _lead
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF _lead.id IS NULL OR _lead.status NOT IN ('completed', 'paid') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_lead_fully_paid(NEW.lead_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.job_releases (
    lead_id,
    account_id,
    customer_id,
    status,
    release_text,
    requested_at,
    updated_at
  ) VALUES (
    NEW.lead_id,
    _lead.account_id,
    _lead.customer_id,
    'pending_signature',
    public.build_job_release_text(NEW.lead_id),
    now(),
    now()
  )
  ON CONFLICT (lead_id)
  DO UPDATE SET
    account_id = EXCLUDED.account_id,
    customer_id = EXCLUDED.customer_id,
    updated_at = now(),
    status = CASE
      WHEN job_releases.status = 'signed' THEN job_releases.status
      ELSE 'pending_signature'
    END,
    release_text = CASE
      WHEN job_releases.status = 'signed' THEN job_releases.release_text
      ELSE job_releases.release_text
    END,
    requested_at = CASE
      WHEN job_releases.status = 'signed' THEN job_releases.requested_at
      ELSE COALESCE(job_releases.requested_at, now())
    END
  RETURNING id INTO _release_id;

  BEGIN
    PERFORM net.http_post(
      url := _project_url || '/functions/v1/send-job-release-notifications',
      body := jsonb_build_object(
        'job_release_id', _release_id,
        'event_type', 'request_signature'
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || _anon_jwt,
        'apikey', _anon_jwt,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Job release request notification dispatch failed for lead %: %', NEW.lead_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_upsert_job_release_for_paid_job ON public.invoices;
CREATE TRIGGER trigger_upsert_job_release_for_paid_job
  AFTER INSERT OR UPDATE OF status, balance_due, total ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.upsert_job_release_for_paid_job();;
