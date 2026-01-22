/*
  # Remove automatic status update trigger
  
  ## Overview
  Remove the trigger and function that automatically updated job status based on schedules.
  This is no longer needed with the simplified status system where:
  - Status remains "job" throughout the job lifecycle
  - Display status is computed from job_schedules table on the fly
  
  ## Changes
  - Drop trigger_update_job_completion trigger
  - Drop update_job_completion_status function
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_job_completion ON public.job_schedules;

-- Drop the function
DROP FUNCTION IF EXISTS public.update_job_completion_status();
