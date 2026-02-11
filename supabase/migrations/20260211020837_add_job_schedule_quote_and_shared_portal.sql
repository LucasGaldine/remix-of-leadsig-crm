/*
  # Add master quote and shared client portal to recurring jobs (Job Schedules)

  1. Modified Tables
    - `recurring_jobs`
      - `client_share_token` (uuid, unique, nullable) - Shared client portal token for all instances
    - `estimates`
      - `recurring_job_id` (uuid, FK to recurring_jobs, nullable) - Links master quote to job schedule
      - `job_id` made nullable to allow master quotes without a specific job
      - Unique constraint on job_id converted to partial unique index (WHERE job_id IS NOT NULL)
      - Check constraint: every estimate must belong to either a job OR a recurring job

  2. Trigger Changes
    - `auto_create_estimate_for_job` updated to skip auto-creating estimates for recurring job instances
      (they share the master quote on the job schedule instead)

  3. Security
    - Index on estimates.recurring_job_id for query performance
    - Index on recurring_jobs.client_share_token for portal lookups
    - RLS policies updated for estimates to allow crew members to view recurring job quotes

  4. Notes
    - Non-recurring jobs are unaffected
    - Existing estimates remain unchanged
    - The "master quote" for a recurring job is an estimate with recurring_job_id set and job_id NULL
*/

-- 1. Add client_share_token to recurring_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_jobs' AND column_name = 'client_share_token'
  ) THEN
    ALTER TABLE recurring_jobs ADD COLUMN client_share_token uuid UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_client_share_token
  ON recurring_jobs(client_share_token) WHERE client_share_token IS NOT NULL;

-- 2. Add recurring_job_id to estimates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'recurring_job_id'
  ) THEN
    ALTER TABLE estimates ADD COLUMN recurring_job_id uuid REFERENCES recurring_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimates_recurring_job_id
  ON estimates(recurring_job_id) WHERE recurring_job_id IS NOT NULL;

-- 3. Make estimates.job_id nullable (for master quotes that belong to a job schedule, not a specific job)
ALTER TABLE estimates ALTER COLUMN job_id DROP NOT NULL;

-- 4. Replace the UNIQUE constraint on estimates.job_id with a partial unique index
-- Drop the existing unique constraint first
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_job_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS estimates_job_id_unique_partial
  ON estimates(job_id) WHERE job_id IS NOT NULL;

-- 5. Add check constraint: every estimate must belong to either a job or a recurring job
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimates_must_have_parent'
  ) THEN
    ALTER TABLE estimates ADD CONSTRAINT estimates_must_have_parent
      CHECK (job_id IS NOT NULL OR recurring_job_id IS NOT NULL);
  END IF;
END $$;

-- 6. Update the auto_create_estimate_for_job trigger to skip recurring instances
CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('job', 'paid')
  AND NEW.approval_status = 'approved'
  AND NEW.is_estimate_visit = false
  AND NEW.recurring_job_id IS NULL
  THEN
    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN
      INSERT INTO public.estimates (job_id, customer_id, account_id, status, created_by)
      VALUES (NEW.id, NEW.customer_id, NEW.account_id, 'draft', NEW.created_by);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Update the SELECT RLS policy on estimates to also allow viewing recurring job quotes
DROP POLICY IF EXISTS "Account members can view estimates" ON estimates;

CREATE POLICY "Account members can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM account_members am
      WHERE am.user_id = auth.uid() AND am.is_active = true AND am.role = 'crew_member'
    ) AND (
      job_id IN (
        SELECT ja.lead_id FROM job_assignments ja
        WHERE ja.user_id = auth.uid() AND ja.lead_id IS NOT NULL
      )
      OR
      recurring_job_id IN (
        SELECT l.recurring_job_id FROM leads l
        JOIN job_assignments ja ON ja.lead_id = l.id
        WHERE ja.user_id = auth.uid() AND l.recurring_job_id IS NOT NULL
      )
    ))
  );
