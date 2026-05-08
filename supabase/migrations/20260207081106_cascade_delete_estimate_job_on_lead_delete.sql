/*\n  # Cascade delete estimate job when parent lead is deleted\n\n  1. New Functions\n    - `cleanup_estimate_job_on_lead_delete` - Before a lead is deleted, checks if it has\n      an associated estimate job (via estimate_job_id) and deletes that job too.\n\n  2. New Triggers\n    - `trigger_cleanup_estimate_job` - Fires BEFORE DELETE on leads table to clean up\n      orphaned estimate jobs.\n\n  3. Important Notes\n    - Previously, estimate jobs were only cleaned up when an estimate was manually deleted\n      from the EstimateDetail UI. Deleting a lead directly would leave the estimate job\n      orphaned in the database.\n    - This trigger ensures the estimate job is always removed when its parent lead is deleted,\n      regardless of the deletion path.\n*/\n\nCREATE OR REPLACE FUNCTION public.cleanup_estimate_job_on_lead_delete()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $function$\nBEGIN\n  IF OLD.estimate_job_id IS NOT NULL THEN\n    DELETE FROM public.leads WHERE id = OLD.estimate_job_id;
\n  END IF;
\n  RETURN OLD;
\nEND;
\n$function$;
\n\nDROP TRIGGER IF EXISTS trigger_cleanup_estimate_job ON public.leads;
\n\nCREATE TRIGGER trigger_cleanup_estimate_job\n  BEFORE DELETE ON public.leads\n  FOR EACH ROW\n  EXECUTE FUNCTION public.cleanup_estimate_job_on_lead_delete();
\n;
