/*\n  # Add Invoiced and Paid Statuses, Remove Cancelled Status\n\n  ## Overview\n  This migration updates the unified_status enum to add 'invoiced' and 'paid' statuses for completed jobs, and removes the unused 'cancelled' status.\n\n  ## Changes Made\n  \n  ### 1. Status Enum Updates\n  - Add 'invoiced' status - for jobs that have been invoiced but not yet paid\n  - Add 'paid' status - for jobs that have been completed and payment received\n  - Remove 'cancelled' status - this status is not being used\n  \n  ### 2. Notes\n  - The 'invoiced' and 'paid' statuses will only appear on the Jobs page\n  - No existing records use the 'cancelled' status, so it's safe to remove\n*/\n\n-- Create a temporary enum without 'cancelled' but with new statuses\nDO $$ BEGIN\n  CREATE TYPE public.unified_status_new AS ENUM (\n    'new',\n    'contacted',\n    'qualified',\n    'scheduled',\n    'in_progress',\n    'completed',\n    'won',\n    'lost',\n    'on_hold',\n    'unqualified',\n    'invoiced',\n    'paid'\n  );
\nEXCEPTION\n  WHEN duplicate_object THEN NULL;
\nEND $$;
\n\n-- Drop the default on the status column\nALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
\n\n-- Update the leads table to use the new enum\nALTER TABLE public.leads \n  ALTER COLUMN status TYPE public.unified_status_new \n  USING status::text::public.unified_status_new;
\n\n-- Drop the old enum and rename the new one\nDROP TYPE IF EXISTS public.unified_status;
\nALTER TYPE public.unified_status_new RENAME TO unified_status;
\n\n-- Restore the default value\nALTER TABLE public.leads \n  ALTER COLUMN status SET DEFAULT 'new'::public.unified_status;
\n;
