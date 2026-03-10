/*
  # Fix Job Costs to Copy to Regular Job

  ## Overview
  Updates the trigger logic to ensure job costs are copied to the regular job, not the estimate job.
  
  When an estimate is approved:
  - If the estimate's job_id points to an estimate visit job (is_estimate_visit = true)
  - Find the parent/regular job (the one with estimate_job_id pointing to this estimate job)
  - Copy line items to the regular job instead
  
  ## Changes
  - Update `copy_estimate_line_items_to_job()` function to correctly identify the target job
  - Handle both estimate visit scenario and direct job scenario
*/

-- Replace the function to copy estimate line items to the correct job
CREATE OR REPLACE FUNCTION copy_estimate_line_items_to_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estimate_job_id uuid;
  v_target_job_id uuid;
  v_account_id uuid;
  v_is_estimate_visit boolean;
BEGIN
  -- Check if estimate status changed to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    v_estimate_job_id := NEW.job_id;
    v_account_id := NEW.account_id;
    
    -- Only proceed if estimate has a linked job
    IF v_estimate_job_id IS NOT NULL THEN
      -- Check if this is an estimate visit job
      SELECT is_estimate_visit INTO v_is_estimate_visit
      FROM leads
      WHERE id = v_estimate_job_id;
      
      IF v_is_estimate_visit THEN
        -- This is an estimate visit, find the parent/regular job
        SELECT id INTO v_target_job_id
        FROM leads
        WHERE estimate_job_id = v_estimate_job_id
        LIMIT 1;
        
        -- If no parent job found, something is wrong, skip
        IF v_target_job_id IS NULL THEN
          RETURN NEW;
        END IF;
      ELSE
        -- This is a direct job, use it as target
        v_target_job_id := v_estimate_job_id;
      END IF;
      
      -- Check if job line items already exist for this job
      -- (to avoid duplicates if estimate is re-approved)
      IF NOT EXISTS (
        SELECT 1 FROM job_line_items 
        WHERE lead_id = v_target_job_id
      ) THEN
        -- Copy all estimate line items to job line items
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
          v_target_job_id,
          name,
          description,
          quantity,
          unit,
          unit_price,
          total,
          sort_order,
          v_account_id,
          id
        FROM estimate_line_items
        WHERE estimate_id = NEW.id
        AND is_change_order = false
        ORDER BY sort_order;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- The trigger is already created, no need to recreate it

-- Also update the function for job creation to use the same logic
CREATE OR REPLACE FUNCTION copy_estimate_items_on_job_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estimate_id uuid;
  v_estimate_status text;
  v_account_id uuid;
  v_estimate_job_id uuid;
  v_target_job_id uuid;
  v_is_estimate_visit boolean;
BEGIN
  -- Check if this is an estimate visit job being created
  IF NEW.is_estimate_visit THEN
    -- Don't copy anything for estimate visit jobs
    RETURN NEW;
  END IF;
  
  -- Get the estimate for this job (if any)
  SELECT id, status, account_id, job_id
  INTO v_estimate_id, v_estimate_status, v_account_id, v_estimate_job_id
  FROM estimates
  WHERE job_id = NEW.id
  LIMIT 1;
  
  -- If there's an approved estimate, copy its line items
  IF v_estimate_id IS NOT NULL AND v_estimate_status = 'accepted' THEN
    -- The target is this newly created job
    v_target_job_id := NEW.id;
    
    -- Check if line items don't already exist
    IF NOT EXISTS (
      SELECT 1 FROM job_line_items 
      WHERE lead_id = v_target_job_id
    ) THEN
      -- Copy line items
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
        v_target_job_id,
        name,
        description,
        quantity,
        unit,
        unit_price,
        total,
        sort_order,
        v_account_id,
        id
      FROM estimate_line_items
      WHERE estimate_id = v_estimate_id
      AND is_change_order = false
      ORDER BY sort_order;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;