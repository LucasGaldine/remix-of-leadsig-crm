/*
  # Fix auto create estimate function - remove paid status

  1. Changes
    - Update trigger function to only check for 'job' status (not 'paid')
    - Remove reference to invalid 'paid' enum value
*/

CREATE OR REPLACE FUNCTION auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tax_rate numeric(5,4);
  v_profit_margin numeric;
BEGIN
  IF NEW.status = 'job' AND NEW.approval_status = 'approved' THEN
    IF NOT EXISTS (SELECT 1 FROM estimates WHERE job_id = NEW.id) THEN
      SELECT 
        COALESCE(default_tax_rate / 100, 0),
        COALESCE(default_profit_margin, 0)
      INTO v_tax_rate, v_profit_margin
      FROM accounts
      WHERE id = NEW.account_id;

      INSERT INTO estimates (
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
$$;