/*
  # Fix auto_create_estimate_for_job to use account's default tax rate

  ## Overview
  Update the auto_create_estimate_for_job function to fetch and use the account's default_tax_rate
  instead of hardcoding it to 0.08 (8%).

  ## Changes
  - Fetch the account's default_tax_rate from the accounts table
  - Use the fetched tax rate (converted from percentage to decimal) when creating estimates
  - If no tax rate is found, default to 0 instead of 8% for safety
*/

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tax_rate numeric(5,4);
BEGIN
  -- Only create estimate for actual jobs (not leads)
  IF NEW.status IN ('job', 'paid')
  AND NEW.approval_status = 'approved' THEN

    -- Check if estimate already exists for this job
    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN

      -- Fetch the account's default tax rate (stored as percentage, e.g., 8.00)
      SELECT COALESCE(default_tax_rate / 100, 0)
      INTO v_tax_rate
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
        'draft',
        NEW.created_by,
        'Auto-generated estimate for ' || NEW.name
      );

      RAISE NOTICE 'Auto-created estimate for job % with tax rate %', NEW.id, v_tax_rate;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;