/*
  # Remove In Progress and Completed Statuses
  
  ## Overview
  This migration removes 'in_progress' and 'completed' from the unified_status enum.
  Instead, the frontend will compute the display status dynamically based on job schedules:
  - Jobs show as "In Progress" when current time is between first and last schedule dates
  - Jobs show as "Completed" when current time is after the last schedule date
  - Jobs remain in "scheduled" status in the database
  
  ## Changes Made
  
  ### 1. Status Updates
  - Update any existing 'in_progress' jobs to 'scheduled'
  - Update any existing 'completed' jobs to 'scheduled'
  
  ### 2. Enum Modifications
  - Remove 'in_progress' from unified_status enum
  - Remove 'completed' from unified_status enum
  
  ### 3. Important Notes
  - This change makes the status field cleaner and more maintainable
  - Display status is now computed from schedule data, not stored in the database
  - Jobs will only be marked as 'won', 'invoiced', or 'paid' when those business events occur
*/

-- Step 1: Update existing jobs with in_progress or completed status to scheduled
UPDATE public.leads 
SET status = 'scheduled'
WHERE status IN ('in_progress', 'completed');

-- Step 2: Create new enum without in_progress and completed
DO $$ BEGIN
  CREATE TYPE public.unified_status_new AS ENUM (
    'new',
    'contacted',
    'qualified',
    'scheduled',
    'won',
    'lost',
    'on_hold',
    'unqualified',
    'invoiced',
    'paid'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Drop the default on the status column
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- Step 4: Update the leads table to use the new enum
ALTER TABLE public.leads 
  ALTER COLUMN status TYPE public.unified_status_new 
  USING status::text::public.unified_status_new;

-- Step 5: Drop the old enum and rename the new one
DROP TYPE IF EXISTS public.unified_status;
ALTER TYPE public.unified_status_new RENAME TO unified_status;

-- Step 6: Restore the default value
ALTER TABLE public.leads 
  ALTER COLUMN status SET DEFAULT 'new'::public.unified_status;
