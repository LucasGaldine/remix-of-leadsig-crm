/*
  # Fix estimate job status when lead converts to job

  ## Overview
  Previously, when a lead auto-converted to a job (estimate approved + photos uploaded),
  the linked estimate visit job was set to status 'paid'. This was incorrect - the
  estimate visit should show as 'completed', not 'paid'.

  ## Changes
  - Modified `try_convert_lead_to_job` function
  - Instead of setting estimate job status to 'paid', mark its schedules as completed
  - The estimate job stays at status 'job' so its display status computes to 'completed'
    based on schedule dates

  ## Important Notes
  - 'completed' is a computed display status, not an enum value
  - A job with status 'job' whose schedule dates are in the past displays as 'completed'
  - Marking schedules as is_completed=true ensures they're tracked as done
*/

CREATE OR REPLACE FUNCTION try_convert_lead_to_job(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead record;
  _has_accepted_estimate boolean;
  _has_photos boolean;
BEGIN
  SELECT status, estimate_job_id INTO _lead
  FROM leads
  WHERE id = p_lead_id;

  IF _lead.status IS NULL OR _lead.status IN ('job', 'paid') THEN
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

    IF _lead.estimate_job_id IS NOT NULL THEN
      UPDATE job_schedules
      SET is_completed = true, completed_at = now()
      WHERE lead_id = _lead.estimate_job_id;
    END IF;

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
