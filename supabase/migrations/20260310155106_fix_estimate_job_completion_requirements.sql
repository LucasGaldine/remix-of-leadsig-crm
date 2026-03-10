/*
  # Fix estimate job completion requirements

  1. Changes
    - Update `try_convert_lead_to_job` function to check if all checklist items
      are completed before auto-converting an estimate visit job to a regular job
    - For estimate visit jobs (is_estimate_visit=true, status='job'), require:
      - Accepted estimate AND
      - At least one before photo AND  
      - All checklist items completed
    - This ensures the confirmation modal flow is respected

  2. Important Notes
    - Regular leads (not estimate visit jobs) are unaffected
    - The frontend modal still provides the final confirmation
    - This prevents premature conversion when photos are uploaded
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
  _has_before_photos boolean;
  _all_checklist_complete boolean;
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
    SELECT 1 FROM lead_photos WHERE lead_id = p_lead_id AND photo_type = 'before'
  ) INTO _has_before_photos;

  IF NOT (_has_accepted_estimate AND _has_before_photos) THEN
    RETURN;
  END IF;

  -- For estimate visit jobs, also check that all checklist items are complete
  IF _lead.is_estimate_visit = true AND _lead.status = 'job' THEN
    -- Check if all checklist items are completed
    SELECT CASE 
      WHEN count(*) = 0 THEN false
      WHEN count(*) FILTER (WHERE is_completed = false) > 0 THEN false
      ELSE true
    END INTO _all_checklist_complete
    FROM job_checklist_items
    WHERE job_id = p_lead_id;

    -- Only proceed if all checklist items are complete
    IF NOT _all_checklist_complete THEN
      RETURN;
    END IF;

    -- Create new regular job from estimate visit
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

  -- Regular lead conversion (non-estimate visit)
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