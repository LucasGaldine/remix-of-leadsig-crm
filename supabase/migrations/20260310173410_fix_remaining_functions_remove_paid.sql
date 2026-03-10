/*
  # Fix remaining functions - remove paid status

  1. Changes
    - Update cleanup_estimate_job_on_lead_delete to check for 'job' and 'completed' only
    - Update validate_invoice_job_completion to check for 'completed' and 'invoiced' only
*/

CREATE OR REPLACE FUNCTION cleanup_estimate_job_on_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.estimate_job_id IS NOT NULL
  AND OLD.status NOT IN ('job', 'completed') THEN
    DELETE FROM leads WHERE id = OLD.estimate_job_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION validate_invoice_job_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM leads
    WHERE id = NEW.job_id
    AND status IN ('completed', 'invoiced')
  ) THEN
    RAISE EXCEPTION 'Cannot create invoice for job that is not completed';
  END IF;

  RETURN NEW;
END;
$$;