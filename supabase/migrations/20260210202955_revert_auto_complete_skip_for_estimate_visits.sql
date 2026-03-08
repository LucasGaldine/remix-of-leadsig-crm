/*
  # Revert auto-complete skip for estimate visits

  ## Problem
  The previous migration incorrectly made auto_complete_job_on_checklist
  skip estimate visit jobs. Estimate visit jobs SHOULD be auto-completed
  when all checklist items are done - this is the signal that the crew
  has finished the visit and the estimate needs review.

  ## Changes
  - Restore auto_complete_job_on_checklist to work for ALL job types
    including estimate visits
  - The try_convert_lead_to_job fix (status IN 'job','completed')
    from the previous migration remains correct
*/

CREATE OR REPLACE FUNCTION auto_complete_job_on_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  completed_count integer;
  current_status unified_status;
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    SELECT count(*), count(*) FILTER (WHERE is_completed = true)
    INTO total_count, completed_count
    FROM job_checklist_items
    WHERE job_id = NEW.job_id;

    IF total_count > 0 AND total_count = completed_count THEN
      SELECT status INTO current_status FROM leads WHERE id = NEW.job_id;

      IF current_status = 'job' THEN
        UPDATE leads SET status = 'completed' WHERE id = NEW.job_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
