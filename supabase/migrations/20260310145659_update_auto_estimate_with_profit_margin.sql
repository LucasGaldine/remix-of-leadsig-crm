/*
  # Update auto_create_estimate_for_job to include default profit margin

  ## Overview
  Updates the auto_create_estimate_for_job function to fetch and apply the account's
  default_profit_margin in addition to the default_tax_rate.

  ## Changes
  - Fetch the account's default_profit_margin from the accounts table
  - Set the profit_margin field when creating the estimate
  - Profit margin is stored as a percentage (e.g., 20 for 20%)
  
  ## Important Notes
  - Line items copied to job costs will NOT include profit margin
  - Line items represent actual costs
  - Profit margin is applied at the estimate level for pricing
  - Tax is considered part of the cost structure
*/

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tax_rate numeric(5,4);
  v_profit_margin numeric;
BEGIN
  -- Only create estimate for actual jobs (not leads)
  IF NEW.status IN ('job', 'paid')
  AND NEW.approval_status = 'approved' THEN

    -- Check if estimate already exists for this job
    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN

      -- Fetch the account's default tax rate (stored as percentage, e.g., 8.00)
      -- and default profit margin (stored as percentage, e.g., 20.00)
      SELECT 
        COALESCE(default_tax_rate / 100, 0),
        COALESCE(default_profit_margin, 0)
      INTO v_tax_rate, v_profit_margin
      FROM public.accounts
      WHERE id = NEW.account_id;

      -- Create a draft estimate linked to the job
      INSERT INTO public.estimates (
        customer_id,
        job_id,
        account_id,
        subtotal,
        tax_rate,
        tax,
        discount,
        total,
        profit_margin,
        status,
        created_by,
        notes
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        NEW.account_id,
        0,
        v_tax_rate,
        0,
        0,
        0,
        v_profit_margin,
        'draft',
        NEW.created_by,
        'Auto-generated estimate for ' || NEW.name
      );

      RAISE NOTICE 'Auto-created estimate for job % with tax rate % and profit margin %', NEW.id, v_tax_rate, v_profit_margin;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;