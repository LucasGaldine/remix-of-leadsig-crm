/*
  # Rework Invoices as Separate from Estimates

  1. Changes to Tables
    - `estimates`
      - Drop `is_finalized` column (no longer needed since estimates don't convert to invoices)

    - `invoices`
      - Make `estimate_id` NOT NULL (all invoices must be tied to an estimate)
      - Add `invoice_number` column for tracking invoice numbering
      - Add index on `estimate_id` for better query performance

  2. New Functions
    - `validate_invoice_total()` - Ensures sum of invoices for an estimate doesn't exceed estimate total

  3. New Triggers
    - Trigger to validate invoice total before insert/update

  4. Important Notes
    - Estimates remain editable and never get "finalized"
    - Multiple invoices can be created for a single estimate
    - Invoice totals cannot exceed the estimate total
    - Invoice numbering is sequential per account
*/

-- Drop the is_finalized column from estimates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'is_finalized'
  ) THEN
    ALTER TABLE estimates DROP COLUMN is_finalized;
  END IF;
END $$;

-- Make estimate_id NOT NULL on invoices (all invoices must reference an estimate)
DO $$
BEGIN
  -- First update any NULL values to a valid estimate_id if they exist
  -- We'll skip this as invoices without estimates should not exist in the new flow

  -- Make the column NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'estimate_id'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN estimate_id SET NOT NULL;
  END IF;
END $$;

-- Add invoice_number column for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_number integer;
  END IF;
END $$;

-- Add index on estimate_id for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON invoices(estimate_id);

-- Function to validate that invoice totals don't exceed estimate total
CREATE OR REPLACE FUNCTION validate_invoice_total()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_estimate_total numeric(12,2);
  v_existing_invoices_total numeric(12,2);
  v_new_total numeric(12,2);
BEGIN
  -- Get the estimate total
  SELECT total INTO v_estimate_total
  FROM estimates
  WHERE id = NEW.estimate_id;

  IF v_estimate_total IS NULL THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  -- Get the sum of existing invoices for this estimate (excluding current invoice if updating)
  SELECT COALESCE(SUM(total), 0) INTO v_existing_invoices_total
  FROM invoices
  WHERE estimate_id = NEW.estimate_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  -- Calculate new total
  v_new_total := v_existing_invoices_total + NEW.total;

  -- Check if new total exceeds estimate total
  IF v_new_total > v_estimate_total THEN
    RAISE EXCEPTION 'Invoice total ($%) would exceed estimate total ($%). Remaining: $%',
      v_new_total,
      v_estimate_total,
      v_estimate_total - v_existing_invoices_total;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate invoice totals
DROP TRIGGER IF EXISTS validate_invoice_total_trigger ON invoices;
CREATE TRIGGER validate_invoice_total_trigger
  BEFORE INSERT OR UPDATE OF total ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_total();

-- Function to generate next invoice number for an account
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_account_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_number integer;
BEGIN
  SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO v_next_number
  FROM invoices
  WHERE account_id = p_account_id;

  RETURN v_next_number;
END;
$$;

-- Add comment explaining the new workflow
COMMENT ON TABLE invoices IS 'Invoices are separate from estimates. Multiple invoices can be created for a single estimate, but their total cannot exceed the estimate total.';
COMMENT ON COLUMN invoices.estimate_id IS 'Required reference to the estimate this invoice is based on';
COMMENT ON COLUMN invoices.invoice_number IS 'Sequential invoice number per account for tracking';
