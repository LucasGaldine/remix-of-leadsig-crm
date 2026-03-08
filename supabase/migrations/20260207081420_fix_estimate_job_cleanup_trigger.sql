/*
  # Fix estimate job cleanup trigger

  1. Changes
    - Replace BEFORE DELETE trigger with AFTER DELETE trigger to avoid circular
      FK constraint conflict (ON DELETE SET NULL firing back on the row being deleted).
    - After the parent lead is already gone, safely delete the orphaned estimate job.
*/

DROP TRIGGER IF EXISTS trigger_cleanup_estimate_job ON public.leads;
DROP FUNCTION IF EXISTS public.cleanup_estimate_job_on_lead_delete();

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

CREATE TRIGGER trigger_cleanup_estimate_job
  AFTER DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_estimate_job_on_lead_delete();
