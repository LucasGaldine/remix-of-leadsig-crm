/*
  # Preserve invoices when estimate is deleted

  ## Problem
  When deleting a customer:
  1. Customer deletion cascades to estimates (ON DELETE CASCADE)
  2. Estimates have invoices referencing them via estimate_id (NOT NULL, ON DELETE NO ACTION)
  3. The foreign key constraint blocks the deletion with error:
     "update or delete on table "estimates" violates foreign key constraint "invoices_estimate_id_fkey""

  ## Solution
  Make invoices.estimate_id nullable and change the foreign key constraint to SET NULL on delete.
  This preserves invoices as historical records even when estimates or customers are deleted.

  ## Changes
  1. Make invoices.estimate_id nullable (remove NOT NULL constraint)
  2. Change foreign key constraint from ON DELETE NO ACTION to ON DELETE SET NULL
  3. Update the validate_invoice_total trigger to handle NULL estimate_id gracefully

  ## Important Notes
  - Invoices are historical/accounting records that should be preserved
  - Even if the estimate or customer is deleted, the invoice data remains for auditing
  - The invoice still maintains its total, line items, and payment information
*/

-- Make estimate_id nullable in invoices table
ALTER TABLE invoices 
ALTER COLUMN estimate_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_estimate_id_fkey;

-- Add the new foreign key constraint with SET NULL
ALTER TABLE invoices 
ADD CONSTRAINT invoices_estimate_id_fkey 
FOREIGN KEY (estimate_id) 
REFERENCES estimates(id) 
ON DELETE SET NULL;

-- Update the validate_invoice_total function to handle NULL estimate_id
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
  -- Skip validation if estimate_id is NULL (estimate was deleted)
  IF NEW.estimate_id IS NULL THEN
    RETURN NEW;
  END IF;

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

-- Update table comment
COMMENT ON COLUMN invoices.estimate_id IS 'Reference to the estimate this invoice is based on. Can be NULL if the estimate was deleted (invoice is preserved as historical record).';
