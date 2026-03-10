/*
  # Backfill tax data for existing jobs

  1. Updates
    - Copy tax information from estimates to existing jobs that have accepted estimates
    - This ensures all jobs display correct tax information in the Job Costs view
*/

-- Backfill tax data for jobs that have accepted estimates
UPDATE leads
SET 
  tax_rate = COALESCE(e.tax_rate, 0),
  tax = COALESCE(e.tax, 0),
  subtotal = COALESCE(e.subtotal, 0),
  total_with_tax = COALESCE(e.total, 0)
FROM estimates e
WHERE leads.id = e.job_id
  AND e.status = 'accepted'
  AND (leads.tax = 0 OR leads.subtotal = 0 OR leads.total_with_tax = 0);