/*
  # Add tax tracking to jobs

  1. New Columns on `leads` table
    - `tax_rate` (numeric) - Tax rate applied (e.g., 0.08 for 8%)
    - `tax` (numeric) - Calculated tax amount
    - `subtotal` (numeric) - Subtotal before tax
    - `total_with_tax` (numeric) - Total including tax

  2. Updates
    - Modify `try_convert_lead_to_job` to copy tax from estimate to new job
    - These fields will be populated when job is created from estimate
*/

-- Add tax tracking columns to leads table
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_with_tax numeric DEFAULT 0;

-- Update the conversion function to copy tax information
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

    -- Get the estimate data including tax information
    SELECT id, account_id, tax_rate, tax, subtotal, total
    INTO _estimate
    FROM estimates
    WHERE job_id = p_lead_id AND status = 'accepted'
    LIMIT 1;

    -- Create new regular job from estimate visit
    INSERT INTO leads (
      name, status, service_type, address, city, state,
      customer_id, account_id, created_by,
      approval_status, is_estimate_visit, estimate_job_id,
      estimated_value, phone, email, source,
      tax_rate, tax, subtotal, total_with_tax
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
      _lead.source,
      COALESCE(_estimate.tax_rate, 0),
      COALESCE(_estimate.tax, 0),
      COALESCE(_estimate.subtotal, 0),
      COALESCE(_estimate.total, 0)
    )
    RETURNING id INTO _new_job_id;

    -- Copy job line items from estimate to new job
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
        estimate_line_item_id
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
        id
      FROM estimate_line_items
      WHERE estimate_id = _estimate.id
      AND is_change_order = false
      ORDER BY sort_order;
    END IF;

    -- Update estimate to point to new job
    UPDATE estimates SET job_id = _new_job_id WHERE job_id = p_lead_id;

    -- Transfer photos to new job
    UPDATE lead_photos SET lead_id = _new_job_id WHERE lead_id = p_lead_id;

    -- Approve the new job
    UPDATE leads SET approval_status = 'approved' WHERE id = _new_job_id;

    -- Mark old estimate visit schedules as complete
    UPDATE job_schedules
    SET is_completed = true, completed_at = now()
    WHERE lead_id = p_lead_id;

    -- Mark estimate visit as completed
    UPDATE leads SET status = 'completed' WHERE id = p_lead_id;

    -- Add interaction log
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