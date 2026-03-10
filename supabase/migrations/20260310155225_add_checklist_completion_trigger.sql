/*
  # Add trigger to convert estimate job when checklist is completed

  1. New Triggers
    - `trigger_convert_on_checklist_complete` on `job_checklist_items` - fires when a
      checklist item is marked complete and checks if all items are now complete

  2. Important Notes
    - This ensures estimate jobs are converted to regular jobs when all requirements are met
    - Works in conjunction with the photo upload trigger
    - Only converts when: accepted estimate + before photos + all checklist complete
*/

CREATE OR REPLACE FUNCTION handle_checklist_item_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if item was just marked as complete
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    PERFORM try_convert_lead_to_job(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_convert_on_checklist_complete'
  ) THEN
    CREATE TRIGGER trigger_convert_on_checklist_complete
      AFTER UPDATE OF is_completed ON job_checklist_items
      FOR EACH ROW
      EXECUTE FUNCTION handle_checklist_item_completed();
  END IF;
END $$;