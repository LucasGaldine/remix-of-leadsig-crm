/*\n  # Fix estimate job cleanup trigger\n\n  1. Changes\n    - Replace BEFORE DELETE trigger with AFTER DELETE trigger to avoid circular\n      FK constraint conflict (ON DELETE SET NULL firing back on the row being deleted).\n    - After the parent lead is already gone, safely delete the orphaned estimate job.\n*/\n\nDROP TRIGGER IF EXISTS trigger_cleanup_estimate_job ON public.leads;
\nDROP FUNCTION IF EXISTS public.cleanup_estimate_job_on_lead_delete();
\n\nCREATE OR REPLACE FUNCTION public.cleanup_estimate_job_on_lead_delete()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $function$\nBEGIN\n  IF OLD.estimate_job_id IS NOT NULL THEN\n    DELETE FROM public.leads WHERE id = OLD.estimate_job_id;
\n  END IF;
\n  RETURN OLD;
\nEND;
\n$function$;
\n\nCREATE TRIGGER trigger_cleanup_estimate_job\n  AFTER DELETE ON public.leads\n  FOR EACH ROW\n  EXECUTE FUNCTION public.cleanup_estimate_job_on_lead_delete();
\n;
