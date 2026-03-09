/*
  # Add Original Estimate Tracking

  1. New Columns in estimates table
    - `original_subtotal` (numeric) - Stores the subtotal when estimate was first approved
    - `original_tax` (numeric) - Stores the tax when estimate was first approved
    - `original_discount` (numeric) - Stores the discount when estimate was first approved
    - `original_total` (numeric) - Stores the total when estimate was first approved
    - `original_notes` (text) - Stores the notes when estimate was first approved

  2. New Table
    - `estimate_line_items_original`
      - Stores a snapshot of line items when estimate is first approved
      - Used to display "original" vs "modified" estimates
      - Has same structure as estimate_line_items but is immutable after creation

  3. Functions
    - `snapshot_estimate_on_approval()` - Trigger function that saves the original state when estimate is approved

  4. Security
    - Enable RLS on new table
    - Add policies for authenticated users to read their account's data
*/

-- Add columns to estimates table to track original approved values
ALTER TABLE estimates 
  ADD COLUMN IF NOT EXISTS original_subtotal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_tax numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_discount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_total numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_notes text DEFAULT NULL;

-- Create table to store original line items snapshot
CREATE TABLE IF NOT EXISTS estimate_line_items_original (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  original_line_item_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'each',
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  account_id uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_estimate_id 
  ON estimate_line_items_original(estimate_id);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_account_id 
  ON estimate_line_items_original(account_id);

-- Enable RLS
ALTER TABLE estimate_line_items_original ENABLE ROW LEVEL SECURITY;

-- RLS Policies for estimate_line_items_original
CREATE POLICY "Users can view original line items for their account"
  ON estimate_line_items_original
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = estimate_line_items_original.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Users can insert original line items for their account"
  ON estimate_line_items_original
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = estimate_line_items_original.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

-- Function to snapshot estimate when first approved
CREATE OR REPLACE FUNCTION snapshot_estimate_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only snapshot if this is the first time being approved (status changing to accepted and original_total is NULL)
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.original_total IS NULL THEN
    -- Save original totals
    NEW.original_subtotal := NEW.subtotal;
    NEW.original_tax := NEW.tax;
    NEW.original_discount := NEW.discount;
    NEW.original_total := NEW.total;
    NEW.original_notes := NEW.notes;

    -- Snapshot all current non-deleted line items into the original table
    INSERT INTO estimate_line_items_original (
      estimate_id,
      original_line_item_id,
      name,
      description,
      quantity,
      unit,
      unit_price,
      total,
      sort_order,
      account_id
    )
    SELECT
      NEW.id,
      eli.id,
      eli.name,
      eli.description,
      eli.quantity,
      eli.unit,
      eli.unit_price,
      eli.total,
      eli.sort_order,
      eli.account_id
    FROM estimate_line_items eli
    WHERE eli.estimate_id = NEW.id
      AND (NOT eli.is_change_order OR eli.change_order_type != 'deleted');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to snapshot on approval
DROP TRIGGER IF EXISTS trigger_snapshot_estimate_on_approval ON estimates;
CREATE TRIGGER trigger_snapshot_estimate_on_approval
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_estimate_on_approval();