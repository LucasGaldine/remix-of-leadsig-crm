/*
  # Simplify Status to Job Lifecycle
  
  ## Overview
  This migration simplifies the unified_status enum to only track the business lifecycle:
  - new: Initial lead status
  - contacted: Lead has been contacted
  - qualified: Lead is qualified
  - job: Lead has become a job (scheduled work)
  - paid: Job has been completed and payment received
  
  Display status (unscheduled, scheduled, in_progress, completed) is computed from schedule data.
  
  ## Changes Made
  
  ### 1. Enum Modifications
  - Create new simplified enum with: new, contacted, qualified, job, paid
  - Remove: scheduled, won, invoiced, lost, on_hold, unqualified
  
  ### 2. Status Updates
  - Update 'scheduled', 'won', 'invoiced' jobs to 'job'
  - Update 'lost', 'on_hold', 'unqualified' leads to 'new'
  
  ### 3. Important Notes
  - Display status is now computed from job_schedules table
  - Status only tracks business progression, not operational state
*/

-- Step 1: Create new simplified enum
DO $$ BEGIN
  CREATE TYPE public.unified_status_new AS ENUM (
    'new',
    'contacted',
    'qualified',
    'job',
    'paid'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Drop the default on the status column
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- Step 3: Update the leads table to use the new enum with mapping
ALTER TABLE public.leads 
  ALTER COLUMN status TYPE public.unified_status_new 
  USING CASE 
    WHEN status IN ('scheduled', 'won', 'invoiced') THEN 'job'::public.unified_status_new
    WHEN status IN ('lost', 'on_hold', 'unqualified') THEN 'new'::public.unified_status_new
    ELSE status::text::public.unified_status_new
  END;

-- Step 4: Drop the old enum and rename the new one
DROP TYPE IF EXISTS public.unified_status;
ALTER TYPE public.unified_status_new RENAME TO unified_status;

-- Step 5: Restore the default value
ALTER TABLE public.leads 
  ALTER COLUMN status SET DEFAULT 'new'::public.unified_status;
