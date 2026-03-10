/*
  # Fix Duplicate Estimates from Estimate Job Conversion

  ## Problem
  When an estimate job converts to a regular job via `try_convert_lead_to_job()`:
  1. A new regular job is created with status='job' and estimate_job_id set
  2. The auto_create_estimate trigger fires and creates a NEW estimate
  3. Then the function updates the ORIGINAL estimate's job_id to point to the new job
  4. Result: TWO estimates exist - one created by the trigger, one moved from the estimate job

  ## Solution
  1. Update auto_create_estimate_for_job to skip jobs that have estimate_job_id set
     (these jobs came from estimate visit conversions and already have an estimate being moved)
  2. Clean up existing duplicate estimates by deleting the auto-created ones
     (keeping the original estimates that have line items or were created by users)

  ## Changes
  - Modified `auto_create_estimate_for_job()` function to check for estimate_job_id
  - Delete duplicate auto-generated estimates for jobs with estimate_job_id
*/

-- Update the trigger function to skip jobs from estimate visit conversions
CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if this is not a job status
  IF NEW.status NOT IN ('job', 'paid') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if not approved
  IF NEW.approval_status != 'approved' THEN
    RETURN NEW;
  END IF;
  
  -- Skip estimate visit jobs (they should not have their own estimate)
  IF NEW.name LIKE '%, Estimate' THEN
    RETURN NEW;
  END IF;
  
  -- Skip jobs created from estimate visit conversions
  -- These jobs have estimate_job_id set and the estimate is moved by try_convert_lead_to_job
  IF NEW.estimate_job_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Clean up duplicate estimates
-- For jobs with estimate_job_id, delete the auto-created estimate and keep the original
DO $$
DECLARE
  _job_record RECORD;
  _estimate_to_delete uuid;
  _estimate_to_keep uuid;
BEGIN
  FOR _job_record IN 
    SELECT 
      l.id as job_id,
      l.estimate_job_id,
      array_agg(e.id ORDER BY e.created_at) as estimate_ids,
      array_agg(
        COALESCE(
          (SELECT COUNT(*) FROM estimate_line_items WHERE estimate_id = e.id),
          0
        ) ORDER BY e.created_at
      ) as line_item_counts
    FROM leads l
    INNER JOIN estimates e ON e.job_id = l.id
    WHERE l.estimate_job_id IS NOT NULL
    GROUP BY l.id, l.estimate_job_id
    HAVING COUNT(e.id) > 1
  LOOP
    -- Keep the estimate with line items, or the older one if both have line items or neither do
    IF _job_record.line_item_counts[1] > 0 THEN
      _estimate_to_keep := _job_record.estimate_ids[1];
      _estimate_to_delete := _job_record.estimate_ids[2];
    ELSIF _job_record.line_item_counts[2] > 0 THEN
      _estimate_to_keep := _job_record.estimate_ids[2];
      _estimate_to_delete := _job_record.estimate_ids[1];
    ELSE
      -- Both have no line items, keep the first (older) one
      _estimate_to_keep := _job_record.estimate_ids[1];
      _estimate_to_delete := _job_record.estimate_ids[2];
    END IF;
    
    -- Delete the duplicate estimate
    DELETE FROM estimates WHERE id = _estimate_to_delete;
    
    RAISE NOTICE 'Deleted duplicate estimate % for job %, kept estimate %', 
      _estimate_to_delete, _job_record.job_id, _estimate_to_keep;
  END LOOP;
END $$;
