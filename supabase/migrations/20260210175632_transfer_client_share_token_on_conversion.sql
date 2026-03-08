/*
  # Transfer client_share_token when estimate job converts to regular job

  1. Modified Functions
    - `try_convert_lead_to_job(lead_id uuid)` - When creating a new regular job
      from an estimate visit, the client_share_token is now transferred from the
      estimate job to the new regular job. This ensures clients always see the
      same portal link regardless of whether the job started as an estimate visit.

  2. Important Notes
    - The client_share_token has a UNIQUE constraint, so it must be cleared from
      the estimate job before being set on the new job.
    - This prevents the issue where estimate jobs and regular jobs had different
      client portal links.
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
  _new_job_id uuid;
BEGIN
  SELECT * INTO _lead FROM leads WHERE id = p_lead_id;

  IF _lead IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM estimates WHERE job_id = p_lead_id AND status = 'accepted'
  ) INTO _has_accepted_estimate;

  SELECT EXISTS (
    SELECT 1 FROM lead_photos WHERE lead_id = p_lead_id
  ) INTO _has_photos;

  IF NOT (_has_accepted_estimate AND _has_photos) THEN
    RETURN;
  END IF;

  IF _lead.is_estimate_visit = true AND _lead.status = 'job' THEN
    INSERT INTO leads (
      name, status, service_type, address, city, state,
      customer_id, account_id, created_by,
      approval_status, is_estimate_visit, estimate_job_id,
      estimated_value, phone, email, source
    )
    VALUES (
      REPLACE(_lead.name, ', Estimate', ''),
      'job',
      _lead.service_type,
      _lead.address,
      _lead.city,
      _lead.state,
      _lead.customer_id,
      _lead.account_id,
      _lead.created_by,
      'pending',
      false,
      p_lead_id,
      _lead.estimated_value,
      _lead.phone,
      _lead.email,
      _lead.source
    )
    RETURNING id INTO _new_job_id;

    UPDATE estimates SET job_id = _new_job_id WHERE job_id = p_lead_id;

    UPDATE lead_photos SET lead_id = _new_job_id WHERE lead_id = p_lead_id;

    UPDATE leads SET approval_status = 'approved' WHERE id = _new_job_id;

    IF _lead.client_share_token IS NOT NULL THEN
      UPDATE leads SET client_share_token = NULL WHERE id = p_lead_id;
      UPDATE leads SET client_share_token = _lead.client_share_token WHERE id = _new_job_id;
    END IF;

    UPDATE job_schedules
    SET is_completed = true, completed_at = now()
    WHERE lead_id = p_lead_id;

    UPDATE leads SET status = 'completed' WHERE id = p_lead_id;

    INSERT INTO interactions (lead_id, type, direction, summary)
    VALUES (
      _new_job_id,
      'status_change',
      'na',
      'Job created from completed estimate visit'
    );

    RETURN;
  END IF;

  IF _lead.status IN ('job', 'paid', 'completed') THEN
    RETURN;
  END IF;

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
END;
$$;
