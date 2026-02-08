/*
  # Change estimate scheduling to convert lead into estimate job

  1. Modified Functions
    - `try_convert_lead_to_job(lead_id uuid)` - Now handles two paths:
      - Path 1: When the lead IS an estimate job (is_estimate_visit=true, status='job'),
        creates a NEW regular job record, moves the estimate and photos to it,
        marks the estimate job's schedules as completed, and sets estimate job status
        to 'completed'.
      - Path 2: When the lead is a regular lead (not an estimate job), keeps the
        existing behavior of updating the lead's status to 'job'.

    - `cleanup_estimate_job_on_lead_delete()` - Updated to only cascade-delete
      estimate jobs when the deleted record is a lead (not a job). This prevents
      deleting the estimate job when the derived regular job is deleted.

  2. Important Notes
    - In the new flow, scheduling an estimate converts the qualified lead itself
      into an estimate job (instead of creating a separate record).
    - When the estimate is approved and photos are uploaded, a new regular job
      is automatically created from the estimate job.
    - The new regular job's estimate_job_id references the estimate job it came from.
    - The estimate and photos are moved to the new regular job.
    - The old non-scheduled path (create estimate without scheduling) still works
      with the existing Path 2 behavior.
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

CREATE OR REPLACE FUNCTION public.cleanup_estimate_job_on_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.estimate_job_id IS NOT NULL
    AND OLD.status NOT IN ('job', 'paid', 'completed') THEN
    DELETE FROM public.leads WHERE id = OLD.estimate_job_id;
  END IF;
  RETURN OLD;
END;
$function$;
