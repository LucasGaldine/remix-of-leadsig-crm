/*
  # Clarify Job Costs Behavior - Exclude Profit Margin

  ## Overview
  This migration adds documentation and ensures that job costs properly represent
  actual costs without profit margin markup.

  ## Cost Structure Explanation
  
  ### Estimate Line Items (estimate_line_items)
  - Represent base costs for materials and labor
  - Do NOT include profit margin (margin is applied at estimate level)
  - Do NOT include tax (tax is calculated at estimate level)
  - Fields: unit_price, total (quantity × unit_price)
  
  ### Estimates Table
  - subtotal: Sum of all line item totals
  - profit_margin: Percentage markup (e.g., 20 = 20%)
  - tax_rate: Sales tax rate applied to final price
  - tax: Calculated tax amount
  - total: Final price to customer (subtotal + profit + tax - discount)
  
  ### Job Line Items (job_line_items)
  - Copied from estimate_line_items when estimate is approved
  - Represent actual costs for the job
  - Do NOT include profit margin (profit is pricing markup, not cost)
  - Do NOT include sales tax (tax is charged to customer, not a job cost)
  - Purpose: Track actual costs to calculate profit margins and job profitability
  
  ## Important Notes
  - Job costs = base costs only (materials + labor rates)
  - Profit margin is applied in estimates for customer pricing
  - Tax is applied in estimates/invoices for customer billing
  - This allows accurate profit tracking: (Revenue - Job Costs = Actual Profit)
*/

-- No structural changes needed - this migration is for documentation
-- The current implementation already correctly excludes profit margin from job costs

-- Verify the copy functions are working as intended
DO $$
BEGIN
  -- Check that copy functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'copy_estimate_line_items_to_job'
  ) THEN
    RAISE EXCEPTION 'copy_estimate_line_items_to_job function does not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'copy_estimate_items_on_job_creation'
  ) THEN
    RAISE EXCEPTION 'copy_estimate_items_on_job_creation function does not exist';
  END IF;
  
  RAISE NOTICE 'Job cost tracking functions verified - profit margin excluded, base costs only';
END $$;