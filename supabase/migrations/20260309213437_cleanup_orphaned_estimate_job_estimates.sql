/*
  # Clean Up Orphaned Estimates Pointing to Estimate Jobs

  ## Problem
  After conversion, some estimates are still pointing to the estimate job
  instead of being moved to the regular job. This creates a situation where:
  - Estimate A points to the estimate job (completed)
  - Estimate B points to the regular job (the real one with line items)
  
  ## Solution
  Delete estimates that:
  1. Point to an estimate job (is_estimate_visit = true)
  2. Where a regular job exists that references this estimate job (via estimate_job_id)
  3. And the regular job already has its own estimate
  
  This cleans up the orphaned estimates that should have been moved but weren't.
*/

DO $$
DECLARE
  _estimate_record RECORD;
BEGIN
  FOR _estimate_record IN 
    SELECT 
      e.id as orphaned_estimate_id,
      e.job_id as estimate_job_id,
      l_est.name as estimate_job_name,
      l_reg.id as regular_job_id,
      l_reg.name as regular_job_name,
      (SELECT id FROM estimates WHERE job_id = l_reg.id LIMIT 1) as regular_job_estimate_id
    FROM estimates e
    INNER JOIN leads l_est ON l_est.id = e.job_id AND l_est.is_estimate_visit = true
    INNER JOIN leads l_reg ON l_reg.estimate_job_id = l_est.id
    WHERE EXISTS (
      SELECT 1 FROM estimates WHERE job_id = l_reg.id
    )
  LOOP
    -- Delete the orphaned estimate pointing to the estimate job
    DELETE FROM estimates WHERE id = _estimate_record.orphaned_estimate_id;
    
    RAISE NOTICE 'Deleted orphaned estimate % pointing to estimate job % (%), regular job % (%) has estimate %', 
      _estimate_record.orphaned_estimate_id,
      _estimate_record.estimate_job_id,
      _estimate_record.estimate_job_name,
      _estimate_record.regular_job_id,
      _estimate_record.regular_job_name,
      _estimate_record.regular_job_estimate_id;
  END LOOP;
END $$;
