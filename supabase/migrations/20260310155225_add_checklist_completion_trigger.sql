/*\n  # Add trigger to convert estimate job when checklist is completed\n\n  1. New Triggers\n    - `trigger_convert_on_checklist_complete` on `job_checklist_items` - fires when a\n      checklist item is marked complete and checks if all items are now complete\n\n  2. Important Notes\n    - This ensures estimate jobs are converted to regular jobs when all requirements are met\n    - Works in conjunction with the photo upload trigger\n    - Only converts when: accepted estimate + before photos + all checklist complete\n*/\n\nCREATE OR REPLACE FUNCTION handle_checklist_item_completed()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  -- Only proceed if item was just marked as complete\n  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN\n    PERFORM try_convert_lead_to_job(NEW.job_id);
\n  END IF;
\n  RETURN NEW;
\nEND;
\n$$;
\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_convert_on_checklist_complete'\n  ) THEN\n    CREATE TRIGGER trigger_convert_on_checklist_complete\n      AFTER UPDATE OF is_completed ON job_checklist_items\n      FOR EACH ROW\n      EXECUTE FUNCTION handle_checklist_item_completed();
\n  END IF;
\nEND $$;
;
