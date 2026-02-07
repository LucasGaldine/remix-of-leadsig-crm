/*
  # Add estimate job tracking to leads

  1. Modified Tables
    - `leads`
      - `estimate_job_id` (uuid, nullable) - references the "estimate visit" job
        created when scheduling an estimate for this lead

  2. Modified Functions
    - `try_convert_lead_to_job` - now also marks the linked estimate job as 'paid'
      (complete) when the lead converts to a real job

  3. Important Notes
    - The estimate_job_id links a lead to its estimate visit job
    - When a lead converts to a job, the estimate visit job is auto-completed
    - This keeps the estimate visit on the schedule until it's no longer needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'estimate_job_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN estimate_job_id uuid REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
END $$;

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
      UPDATE leads SET status = 'paid' WHERE id = _lead.estimate_job_id;
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
