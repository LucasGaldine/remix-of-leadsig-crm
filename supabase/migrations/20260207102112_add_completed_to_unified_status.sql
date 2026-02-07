/*
  # Add 'completed' status to unified_status enum

  1. Changes
    - Adds 'completed' value to the `unified_status` enum type
    - Used for estimate visit jobs when the original lead is converted to a job

  2. Updated Functions
    - `try_convert_lead_to_job` now sets estimate job status to 'completed'
      instead of 'paid'

  3. Important Notes
    - 'completed' indicates the estimate visit is done (lead was converted)
    - 'paid' remains for actual job payment tracking
*/

ALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'completed';

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
  _estimate_job_id uuid;
BEGIN
  SELECT status, estimate_job_id INTO _lead_status, _estimate_job_id
  FROM leads
  WHERE id = p_lead_id;

  IF _lead_status IS NULL OR _lead_status IN ('job', 'paid', 'completed') THEN
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

    IF _estimate_job_id IS NOT NULL THEN
      UPDATE leads SET status = 'completed' WHERE id = _estimate_job_id;
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
