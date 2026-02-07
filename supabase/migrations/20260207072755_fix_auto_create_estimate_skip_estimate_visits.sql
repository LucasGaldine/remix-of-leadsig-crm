/*
  # Fix auto_create_estimate to skip estimate visit jobs

  ## Overview
  The auto_create_estimate_for_job trigger was creating duplicate estimates
  when scheduling an estimate visit. The trigger fires for any lead inserted
  with status='job' and approval_status='approved', which includes estimate
  visit placeholder jobs.

  ## Changes
  - Updated auto_create_estimate_for_job function to skip leads whose name
    ends with ', Estimate' (the naming convention for estimate visit jobs)
  - This prevents duplicate estimates from being created
*/

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('job', 'paid') 
  AND NEW.approval_status = 'approved'
  AND NEW.name NOT LIKE '%, Estimate' THEN
    
    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
