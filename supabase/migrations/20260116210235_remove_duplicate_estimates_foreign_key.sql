/*
  # Remove duplicate foreign key constraint on estimates table

  ## Problem
  The estimates table has two foreign key constraints from job_id to leads.id:
  - estimates_job_id_fkey
  - estimates_lead_id_fkey (duplicate)
  
  This causes PostgREST to fail with error "more than one relationship was found 
  for 'estimates' and 'leads'" when trying to query estimates with job data.

  ## Changes
  
  1. **Drop duplicate foreign key**
     - Remove estimates_lead_id_fkey constraint
     - Keep estimates_job_id_fkey as the canonical foreign key

  ## Notes
  - This resolves the payments page error
  - The correct foreign key (estimates_job_id_fkey) remains in place
*/

-- Drop the duplicate foreign key constraint
ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_lead_id_fkey;