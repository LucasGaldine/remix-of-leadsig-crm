/*
  # Fix auto-conversion for completed estimate visit jobs

  ## Problem
  When all checklist items on an estimate visit job are completed,
  the `auto_complete_job_on_checklist` trigger sets status to 'completed'.
  Later, when the customer approves the estimate, `try_convert_lead_to_job`
  checks for `status = 'job'` and skips conversion since status is already 'completed'.
  This means the regular job never gets created.

  ## Changes
  1. Update `try_convert_lead_to_job` to also handle estimate visit jobs
     with status 'completed' (not just 'job')
  2. Update `auto_complete_job_on_checklist` to skip estimate visit jobs,
     since their lifecycle is managed by the conversion flow
  3. Add account_id to interaction inserts within try_convert_lead_to_job
     to ensure RLS compatibility
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

  IF _lead.is_estimate_visit = true AND _lead.status IN ('job', 'completed') THEN
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

    INSERT INTO interactions (lead_id, account_id, type, direction, summary)
    VALUES (
      _new_job_id,
      _lead.account_id,
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

  INSERT INTO interactions (lead_id, account_id, type, direction, summary)
  VALUES (
    p_lead_id,
    _lead.account_id,
    'status_change',
    'na',
    'Converted to job (estimate approved + photos uploaded)'
  );
END;
$$;

CREATE OR REPLACE FUNCTION auto_complete_job_on_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  completed_count integer;
  current_status unified_status;
  is_ev boolean;
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    SELECT count(*), count(*) FILTER (WHERE is_completed = true)
    INTO total_count, completed_count
    FROM job_checklist_items
    WHERE job_id = NEW.job_id;

    IF total_count > 0 AND total_count = completed_count THEN
      SELECT status, is_estimate_visit INTO current_status, is_ev
      FROM leads WHERE id = NEW.job_id;

      IF is_ev = true THEN
        RETURN NEW;
      END IF;

      IF current_status = 'job' THEN
        UPDATE leads SET status = 'completed' WHERE id = NEW.job_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
