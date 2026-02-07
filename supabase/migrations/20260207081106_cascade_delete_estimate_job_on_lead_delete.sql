/*
  # Cascade delete estimate job when parent lead is deleted

  1. New Functions
    - `cleanup_estimate_job_on_lead_delete` - Before a lead is deleted, checks if it has
      an associated estimate job (via estimate_job_id) and deletes that job too.

  2. New Triggers
    - `trigger_cleanup_estimate_job` - Fires BEFORE DELETE on leads table to clean up
      orphaned estimate jobs.

  3. Important Notes
    - Previously, estimate jobs were only cleaned up when an estimate was manually deleted
      from the EstimateDetail UI. Deleting a lead directly would leave the estimate job
      orphaned in the database.
    - This trigger ensures the estimate job is always removed when its parent lead is deleted,
      regardless of the deletion path.
*/

CREATE OR REPLACE FUNCTION public.cleanup_estimate_job_on_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.estimate_job_id IS NOT NULL THEN
    DELETE FROM public.leads WHERE id = OLD.estimate_job_id;
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_cleanup_estimate_job ON public.leads;

CREATE TRIGGER trigger_cleanup_estimate_job
  BEFORE DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_estimate_job_on_lead_delete();
