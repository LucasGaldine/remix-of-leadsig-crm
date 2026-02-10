/*
  # Add "Upload before photos" checklist item for estimate jobs

  1. Changes
    - Updates the `create_default_checklist_items` trigger function
    - Estimate visit jobs now get 3 default items:
      - "Navigate to address" (sort_order 0)
      - "Upload before photos" (sort_order 1)
      - "Send client portal" (sort_order 2)
    - Regular jobs still get just "Navigate to address"
*/

CREATE OR REPLACE FUNCTION create_default_checklist_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'job' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'job')) THEN
    INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)
    VALUES (NEW.id, NEW.account_id, 'Navigate to address', 0);

    IF NEW.is_estimate_visit = true THEN
      INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)
      VALUES
        (NEW.id, NEW.account_id, 'Upload before photos', 1),
        (NEW.id, NEW.account_id, 'Send client portal', 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
