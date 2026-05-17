/*
  # Remove accepted-estimate requirement for estimate-visit completion

  ## Changes
  - Updates `try_convert_lead_to_job` so estimate-visit jobs can convert without an
    accepted estimate.
  - Estimate-visit completion still requires:
    - At least one before photo
    - All checklist items completed
  - Regular (non-estimate-visit) lead conversion still requires:
    - Accepted estimate
    - At least one before photo
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
  _estimate record;
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

  -- Estimate-visit completion no longer requires accepted estimate.
  IF _lead.is_estimate_visit = true AND _lead.status = 'job' THEN
    IF NOT _has_before_photos THEN
      RETURN;
    END IF;

    SELECT CASE
      WHEN count(*) = 0 THEN false
      WHEN count(*) FILTER (WHERE is_completed = false) > 0 THEN false
      ELSE true
    END INTO _all_checklist_complete
    FROM job_checklist_items
    WHERE job_id = p_lead_id;

    IF NOT _all_checklist_complete THEN
      RETURN;
    END IF;

    SELECT id, account_id
    INTO _estimate
    FROM estimates
    WHERE job_id = p_lead_id
    ORDER BY
      CASE WHEN status = 'accepted' THEN 0 ELSE 1 END,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST
    LIMIT 1;

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

    IF _estimate.id IS NOT NULL THEN
      INSERT INTO job_line_items (
        lead_id,
        name,
        description,
        quantity,
        unit,
        unit_price,
        total,
        sort_order,
        account_id,
        estimate_line_item_id,
        category
      )
      SELECT
        _new_job_id,
        name,
        description,
        quantity,
        unit,
        unit_price,
        total,
        sort_order,
        _estimate.account_id,
        id,
        category
      FROM estimate_line_items
      WHERE estimate_id = _estimate.id
      AND is_change_order = false
      ORDER BY sort_order;
    END IF;

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

  -- Non-estimate-visit lead conversion still requires accepted estimate + before photos.
  IF NOT (_has_accepted_estimate AND _has_before_photos) THEN
    RETURN;
  END IF;

  IF _lead.status IN ('job', 'completed') THEN
    RETURN;
  END IF;

  UPDATE leads SET status = 'job' WHERE id = p_lead_id;

  IF _lead.estimate_job_id IS NOT NULL THEN
    UPDATE leads SET status = 'completed' WHERE id = _lead.estimate_job_id;
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
