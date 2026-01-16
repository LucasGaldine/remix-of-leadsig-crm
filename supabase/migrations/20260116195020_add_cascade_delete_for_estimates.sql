/*
  # Add Cascade Delete for Estimates
  
  ## Overview
  Ensures that when a job (lead) is deleted, its associated estimate is also deleted automatically.
  
  ## Changes
  1. Add foreign key constraint on estimates.job_id with ON DELETE CASCADE
  2. This ensures data integrity and prevents orphaned estimates
  
  ## Security
  - Maintains existing RLS policies
  - Cascading deletes respect RLS on the estimates table
*/

-- Add foreign key constraint with cascade delete
-- First drop the old constraint if it exists
ALTER TABLE public.estimates 
  DROP CONSTRAINT IF EXISTS estimates_job_id_fkey;

-- Add the new constraint with ON DELETE CASCADE
ALTER TABLE public.estimates 
  ADD CONSTRAINT estimates_job_id_fkey 
  FOREIGN KEY (job_id) 
  REFERENCES public.leads(id) 
  ON DELETE CASCADE;

-- Create an index on job_id if it doesn't exist for better performance
CREATE INDEX IF NOT EXISTS idx_estimates_job_id ON public.estimates(job_id);
