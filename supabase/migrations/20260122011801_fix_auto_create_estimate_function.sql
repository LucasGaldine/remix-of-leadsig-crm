/*
  # Fix auto_create_estimate_for_job function
  
  ## Overview
  Update the auto_create_estimate_for_job function to use the new simplified status enum values.
  
  ## Changes
  - Replace old status checks ('scheduled', 'in_progress', 'completed', 'won', 'invoiced', 'paid')
  - Use new status values ('job', 'paid')
*/

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create estimate for actual jobs (not leads)
  IF NEW.status IN ('job', 'paid') 
  AND NEW.approval_status = 'approved' THEN
    
    -- Check if estimate already exists for this job
    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN
      -- Create a draft estimate linked to the job
      INSERT INTO public.estimates (
        customer_id,
        job_id,
        account_id,
        subtotal,
        tax_rate,
        tax,
        discount,
        total,
        status,
        created_by,
        notes
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        NEW.account_id,
        0,
        0.08,
        0,
        0,
        0,
        'draft',
        NEW.created_by,
        'Auto-generated estimate for ' || NEW.name
      );
      
      RAISE NOTICE 'Auto-created estimate for job %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
