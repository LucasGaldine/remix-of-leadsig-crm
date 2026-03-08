/*
  # Auto-convert lead to job when both estimate approved and photos exist

  1. New Functions
    - `try_convert_lead_to_job(lead_id uuid)` - checks if a lead has both an
      approved estimate and at least one photo; if so, updates status to 'job'
      and logs an interaction

  2. New Triggers
    - `trigger_convert_on_estimate_approved` on `estimates` - fires when an
      estimate's status changes to 'accepted'
    - `trigger_convert_on_photo_added` on `lead_photos` - fires when a new
      photo is inserted

  3. Important Notes
    - Only converts leads that are not already a job or paid
    - Both conditions (approved estimate + photos) must be met
    - Works for all approval paths: manual, customer link, and photo upload
*/

CREATE OR REPLACE FUNCTION try_convert_lead_to_job(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_status text;
  _has_accepted_estimate boolean;
  _has_photos boolean;
BEGIN
  SELECT status INTO _lead_status
  FROM leads
  WHERE id = p_lead_id;

  IF _lead_status IS NULL OR _lead_status IN ('job', 'paid') THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM estimates
    WHERE job_id = p_lead_id AND status = 'accepted'
  ) INTO _has_accepted_estimate;

  SELECT EXISTS (
    SELECT 1 FROM lead_photos
    WHERE lead_id = p_lead_id
  ) INTO _has_photos;

  IF _has_accepted_estimate AND _has_photos THEN
    UPDATE leads SET status = 'job' WHERE id = p_lead_id;

    INSERT INTO interactions (lead_id, type, direction, summary)
    VALUES (
      p_lead_id,
      'status_change',
      'na',
      'Converted to job (estimate approved + photos uploaded)'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION handle_estimate_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') AND NEW.job_id IS NOT NULL THEN
    PERFORM try_convert_lead_to_job(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_photo_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM try_convert_lead_to_job(NEW.lead_id);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_convert_on_estimate_approved'
  ) THEN
    CREATE TRIGGER trigger_convert_on_estimate_approved
      AFTER UPDATE ON estimates
      FOR EACH ROW
      EXECUTE FUNCTION handle_estimate_approved();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_convert_on_photo_added'
  ) THEN
    CREATE TRIGGER trigger_convert_on_photo_added
      AFTER INSERT ON lead_photos
      FOR EACH ROW
      EXECUTE FUNCTION handle_photo_added();
  END IF;
END $$;
