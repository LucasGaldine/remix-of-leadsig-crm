/*
  # Fix Job Status to Allow Schedule Recalculation

  ## Summary
  Updates the job status function to properly recalculate status whenever schedules change,
  even if the job is already marked as completed. This allows adding future dates to bring
  a completed job back to in_progress or scheduled status.

  ## Changes
  - Remove restriction that prevents updating completed jobs
  - Always recalculate status based on current schedule when schedules are modified
  - Properly handle all-day jobs (jobs without specific times)
*/

-- Drop and recreate the function with fixed logic
DROP TRIGGER IF EXISTS trigger_update_job_completion ON job_schedules;
DROP FUNCTION IF EXISTS update_job_completion_status();

CREATE OR REPLACE FUNCTION update_job_completion_status()
RETURNS trigger AS $$
DECLARE
  first_schedule_datetime timestamptz;
  last_schedule_datetime timestamptz;
  current_status text;
  new_status text;
BEGIN
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

  -- Get current job status
  SELECT status INTO current_status
  FROM leads
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);

  -- Determine new status based on schedule
  IF first_schedule_datetime IS NULL THEN
    -- No schedules exist, don't change status
    RETURN COALESCE(NEW, OLD);
  ELSIF now() > last_schedule_datetime THEN
    -- Current time is after the last scheduled datetime
    new_status := 'completed';
  ELSIF now() >= first_schedule_datetime AND now() <= last_schedule_datetime THEN
    -- Current time is within the scheduled range (including all of today if it's a scheduled day)
    new_status := 'in_progress';
  ELSIF now() < first_schedule_datetime THEN
    -- Current time is before the first scheduled datetime
    new_status := 'scheduled';
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
