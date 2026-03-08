/*
  # Add photo_type column to lead_photos

  1. Modified Tables
    - `lead_photos`
      - Added `photo_type` (text, default 'before') - distinguishes before vs after photos

  2. Important Notes
    - All existing photos default to 'before'
    - Valid values: 'before', 'after'
    - Updated auto-convert trigger to only check for 'before' photos
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_photos' AND column_name = 'photo_type'
  ) THEN
    ALTER TABLE lead_photos ADD COLUMN photo_type text NOT NULL DEFAULT 'before';
  END IF;
END $$;

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
    WHERE lead_id = p_lead_id AND photo_type = 'before'
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
