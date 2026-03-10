/*
  # Add Change Order Approval System

  1. Changes to estimates table
    - `has_pending_changes` (boolean) - Indicates if there are unapproved change orders

  2. Changes to estimate_line_items table
    - `change_order_approved` (boolean, nullable) - NULL for original items, false for pending changes, true for approved changes

  3. Security
    - No RLS changes needed as we're just adding columns to existing tables

  This enables a workflow where:
  - After initial approval, any modifications create change orders that need client approval
  - Client can see both original and modified estimates in the portal
  - Change orders must be approved before being considered final
*/

-- Add has_pending_changes to estimates table
ALTER TABLE estimates 
  ADD COLUMN IF NOT EXISTS has_pending_changes boolean DEFAULT false;

-- Add change_order_approved to estimate_line_items table
ALTER TABLE estimate_line_items 
  ADD COLUMN IF NOT EXISTS change_order_approved boolean DEFAULT NULL;

-- Update existing change order items to have change_order_approved = true (assuming they were already implicitly approved)
UPDATE estimate_line_items 
SET change_order_approved = true 
WHERE is_change_order = true 
  AND change_order_approved IS NULL;

-- Create function to check if estimate has pending changes
CREATE OR REPLACE FUNCTION check_estimate_pending_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this estimate has any pending change orders
  UPDATE estimates
  SET has_pending_changes = EXISTS (
    SELECT 1 
    FROM estimate_line_items 
    WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
      AND is_change_order = true 
      AND change_order_approved = false
  )
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update has_pending_changes when line items change
DROP TRIGGER IF EXISTS trigger_check_estimate_pending_changes ON estimate_line_items;
CREATE TRIGGER trigger_check_estimate_pending_changes
  AFTER INSERT OR UPDATE OR DELETE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_estimate_pending_changes();