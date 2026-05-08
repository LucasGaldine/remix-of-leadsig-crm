CREATE OR REPLACE FUNCTION create_default_checklist_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'job' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'job')) THEN
    IF NEW.is_estimate_visit = true THEN
      INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)
      VALUES
        (NEW.id, NEW.account_id, 'Upload before photos', 0),
        (NEW.id, NEW.account_id, 'Send client portal', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;;
