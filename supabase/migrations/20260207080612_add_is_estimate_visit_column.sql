/*
  # Add is_estimate_visit column to leads table

  1. Modified Tables
    - `leads`
      - `is_estimate_visit` (boolean, default false) - Indicates whether a job is an estimate visit
        rather than a regular job. Replaces the previous convention of appending ", Estimate" to the job name.

  2. Trigger Updates
    - `auto_create_estimate_for_job` - Updated to check `is_estimate_visit` column instead of
      name pattern matching. Estimate visits should not auto-generate estimate records.

  3. Important Notes
    - Existing estimate visit jobs (identified by name ending in ", Estimate") are backfilled
      to have is_estimate_visit = true.
    - This ensures the flag cannot be manipulated by users editing the job name.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'is_estimate_visit'
  ) THEN
    ALTER TABLE leads ADD COLUMN is_estimate_visit boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE leads
SET is_estimate_visit = true
WHERE name LIKE '%, Estimate'
  AND status IN ('job', 'paid')
  AND is_estimate_visit = false;

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IN ('job', 'paid')
  AND NEW.approval_status = 'approved'
  AND NEW.is_estimate_visit = false THEN

    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN
      INSERT INTO public.estimates (job_id, account_id, status, total_amount)
      VALUES (NEW.id, NEW.account_id, 'draft', 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
