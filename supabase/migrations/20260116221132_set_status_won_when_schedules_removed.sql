/*
  # Set Status to Won When All Schedules Removed

  ## Summary
  Updates the job status function to set status to 'won' when all schedules
  are removed from a job.

  ## Changes
  - When no schedules exist, set status to 'won' instead of keeping current status
  - This allows jobs to return to 'won' status after all schedule dates are deleted
*/

-- Drop and recreate the function with won status logic
DROP TRIGGER IF EXISTS trigger_update_job_completion ON job_schedules;
DROP FUNCTION IF EXISTS update_job_completion_status();

CREATE OR REPLACE FUNCTION update_job_completion_status()
RETURNS trigger AS $$
DECLARE
  first_schedule_datetime timestamptz;
  last_schedule_datetime timestamptz;
  current_status unified_status;
  new_status unified_status;
  schedule_count int;
BEGIN
  -- Count how many schedules exist for this job
  SELECT COUNT(*) INTO schedule_count
  FROM job_schedules
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id);

  -- Get current job status
  SELECT status INTO current_status
  FROM leads
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);

  -- If no schedules exist, set status to 'won'
  IF schedule_count = 0 THEN
    -- Only update if not already in a final state
    IF current_status NOT IN ('won', 'lost', 'invoiced', 'paid') THEN
      UPDATE leads
      SET status = 'won'::unified_status, updated_at = now()
      WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the first scheduled datetime for this job
  SELECT 
    CASE 
      WHEN scheduled_time_start IS NOT NULL THEN
        (scheduled_date || ' ' || scheduled_time_start)::timestamptz
      ELSE
        (scheduled_date || ' 00:00:00')::timestamptz
    END INTO first_schedule_datetime
  FROM job_schedules
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  ORDER BY scheduled_date ASC, scheduled_time_start ASC NULLS FIRST
  LIMIT 1;

  -- Get the last scheduled datetime for this job
  SELECT 
    CASE 
      WHEN scheduled_time_end IS NOT NULL THEN
        (scheduled_date || ' ' || scheduled_time_end)::timestamptz
      ELSE
        (scheduled_date || ' 23:59:59')::timestamptz
    END INTO last_schedule_datetime
  FROM job_schedules
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  ORDER BY scheduled_date DESC, scheduled_time_end DESC NULLS LAST
  LIMIT 1;

  -- Determine new status based on schedule
  IF now() > last_schedule_datetime THEN
    -- Current time is after the last scheduled datetime
    new_status := 'completed'::unified_status;
  ELSIF now() >= first_schedule_datetime AND now() <= last_schedule_datetime THEN
    -- Current time is within the scheduled range (including all of today if it's a scheduled day)
    new_status := 'in_progress'::unified_status;
  ELSIF now() < first_schedule_datetime THEN
    -- Current time is before the first scheduled datetime
    new_status := 'scheduled'::unified_status;
  END IF;

  -- Update status if it needs to change
  -- Allow updating from 'completed' back to 'in_progress' or 'scheduled' if schedule changed
  -- But never override manually set final statuses like 'won', 'lost', 'invoiced', 'paid'
  IF new_status IS NOT NULL 
     AND new_status != current_status 
     AND current_status NOT IN ('won', 'lost', 'invoiced', 'paid') THEN
    UPDATE leads
    SET status = new_status, updated_at = now()
    WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_update_job_completion
  AFTER INSERT OR UPDATE OR DELETE ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_job_completion_status();
