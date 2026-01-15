/*
  # Add Invoiced and Paid Statuses, Remove Cancelled Status

  ## Overview
  This migration updates the unified_status enum to add 'invoiced' and 'paid' statuses for completed jobs, and removes the unused 'cancelled' status.

  ## Changes Made
  
  ### 1. Status Enum Updates
  - Add 'invoiced' status - for jobs that have been invoiced but not yet paid
  - Add 'paid' status - for jobs that have been completed and payment received
  - Remove 'cancelled' status - this status is not being used
  
  ### 2. Notes
  - The 'invoiced' and 'paid' statuses will only appear on the Jobs page
  - No existing records use the 'cancelled' status, so it's safe to remove
*/

-- Create a temporary enum without 'cancelled' but with new statuses
DO $$ BEGIN
  CREATE TYPE public.unified_status_new AS ENUM (
    'new',
    'contacted',
    'qualified',
    'scheduled',
    'in_progress',
    'completed',
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

-- Drop the default on the status column
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- Update the leads table to use the new enum
ALTER TABLE public.leads 
  ALTER COLUMN status TYPE public.unified_status_new 
  USING status::text::public.unified_status_new;

-- Drop the old enum and rename the new one
DROP TYPE IF EXISTS public.unified_status;
ALTER TYPE public.unified_status_new RENAME TO unified_status;

-- Restore the default value
ALTER TABLE public.leads 
  ALTER COLUMN status SET DEFAULT 'new'::public.unified_status;
