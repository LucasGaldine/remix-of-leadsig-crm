/*
  # Remove Automatic Job Completion Trigger

  1. Changes
    - Drop the trigger that automatically marks jobs as complete when all checklist items are checked
    - Drop the associated trigger function
    
  2. Reason
    - User wants manual approval via confirmation modal before marking job complete
    - The confirmation modal is already implemented in the frontend JobChecklist component
    - This prevents jobs from being marked complete without user consent
*/

DROP TRIGGER IF EXISTS trg_auto_complete_job_on_checklist ON job_checklist_items;
DROP FUNCTION IF EXISTS auto_complete_job_on_checklist();
