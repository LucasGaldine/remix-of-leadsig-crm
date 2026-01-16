/*
  # Fix Job Status Logic for Multi-Day Scheduling

  ## Summary
  Updates the automatic job status logic to properly handle multi-day scheduling:
  - Status is "in_progress" if current date/time is between first and last scheduled date/time
  - Status is "completed" if current date/time is after the last scheduled date/time
  - Status remains "scheduled" if current date/time is before the first scheduled date/time

  ## Changes
  - Replace `update_job_completion_status()` function with improved logic
  - Properly calculates first and last scheduled datetime
  - Sets appropriate status based on current time relative to schedule range
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_job_completion ON job_schedules;
DROP FUNCTION IF EXISTS update_job_completion_status();

-- Create improved function to update job status based on schedule
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
  ELSIF now() >= last_schedule_datetime THEN
    -- Current time is after the last scheduled datetime
    new_status := 'completed';
  ELSIF now() >= first_schedule_datetime AND now() < last_schedule_datetime THEN
    -- Current time is between first and last scheduled datetime
    new_status := 'in_progress';
  ELSIF now() < first_schedule_datetime THEN
    -- Current time is before the first scheduled datetime
    IF current_status IN ('new', 'contacted', 'qualified') THEN
      new_status := 'scheduled';
    ELSE
      -- Keep current status if it's already something else
      new_status := current_status;
    END IF;
  END IF;

  -- Only update if status needs to change and isn't already in a final state
  IF new_status IS NOT NULL 
     AND new_status != current_status 
     AND current_status NOT IN ('completed', 'won', 'lost', 'invoiced', 'paid') THEN
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
