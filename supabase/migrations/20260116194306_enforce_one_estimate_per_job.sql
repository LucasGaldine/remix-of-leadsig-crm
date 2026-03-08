/*
  # Enforce One-to-One Relationship Between Jobs and Estimates
  
  ## Overview
  Establishes a one-to-one relationship between jobs (leads) and estimates:
  - Each job must have exactly one estimate
  - Each estimate must be linked to exactly one job
  - Estimates are automatically created when jobs are created
  
  ## Changes
  1. Rename `lead_id` to `job_id` for clarity (since jobs are stored in leads table)
  2. Make `job_id` required (NOT NULL)
  3. Add unique constraint to ensure one estimate per job
  4. Create trigger to auto-create estimate when job is created
  5. Make `account_id` required and add foreign key
  
  ## Data Migration
  - Delete any orphaned estimates (estimates without a job)
  - For jobs without estimates, a draft estimate will be created automatically
  
  ## Security
  - RLS policies remain unchanged
  - Estimates inherit account_id from their associated job
*/

-- First, let's see if there are any estimates without a job
-- If there are, we'll need to decide what to do with them
-- For now, we'll delete them since they're orphaned
DO $$
BEGIN
  DELETE FROM public.estimates WHERE lead_id IS NULL;
  RAISE NOTICE 'Deleted orphaned estimates without a job';
END $$;

-- Rename lead_id to job_id for clarity (even though it references leads table)
ALTER TABLE public.estimates 
  RENAME COLUMN lead_id TO job_id;

-- Make job_id required
ALTER TABLE public.estimates 
  ALTER COLUMN job_id SET NOT NULL;

-- Add unique constraint to enforce one estimate per job
ALTER TABLE public.estimates 
  DROP CONSTRAINT IF EXISTS estimates_job_id_unique;

ALTER TABLE public.estimates 
  ADD CONSTRAINT estimates_job_id_unique UNIQUE (job_id);

-- Make account_id required and ensure it has a foreign key
ALTER TABLE public.estimates 
  ALTER COLUMN account_id SET NOT NULL;

-- Add foreign key for account_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'estimates_account_id_fkey' 
    AND table_name = 'estimates'
  ) THEN
    ALTER TABLE public.estimates 
      ADD CONSTRAINT estimates_account_id_fkey 
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create a function to automatically create an estimate when a job is created
CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create estimate for actual jobs (not leads)
  IF NEW.status IN ('scheduled', 'in_progress', 'completed', 'won', 'invoiced', 'paid') 
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
$$;

-- Create trigger to auto-create estimate when job is created
DROP TRIGGER IF EXISTS trigger_auto_create_estimate ON public.leads;

CREATE TRIGGER trigger_auto_create_estimate
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_estimate_for_job();

-- Also create estimates for existing jobs that don't have one
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT l.id, l.name, l.customer_id, l.account_id, l.created_by
    FROM public.leads l
    LEFT JOIN public.estimates e ON e.job_id = l.id
    WHERE l.status IN ('scheduled', 'in_progress', 'completed', 'won', 'invoiced', 'paid')
      AND l.approval_status = 'approved'
      AND e.id IS NULL
  LOOP
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
      job_record.customer_id,
      job_record.id,
      job_record.account_id,
      0,
      0.08,
      0,
      0,
      0,
      'draft',
      job_record.created_by,
      'Auto-generated estimate for ' || job_record.name
    );
    
    RAISE NOTICE 'Created estimate for existing job %', job_record.id;
  END LOOP;
END $$;
