/*
  # Create Job Line Items and Cost Tracking

  ## Overview
  Add job cost tracking functionality by creating job_line_items table and triggers to automatically
  copy estimate line items when estimates are approved or when jobs are created with approved estimates.

  ## New Tables
  
  ### `job_line_items`
  - `id` (uuid, primary key) - Unique identifier
  - `lead_id` (uuid, foreign key) - Reference to the job (leads table)
  - `name` (text) - Line item name/description
  - `description` (text, nullable) - Detailed description
  - `quantity` (numeric) - Quantity of this item
  - `unit` (text) - Unit of measurement (sq ft, each, etc.)
  - `unit_price` (numeric) - Price per unit
  - `total` (numeric) - Total price (quantity × unit_price)
  - `sort_order` (integer) - Display order
  - `account_id` (uuid, foreign key) - Reference to account
  - `estimate_line_item_id` (uuid, nullable) - Reference to original estimate line item
  - `created_at` (timestamptz) - Creation timestamp
  
  ## Security
  - Enable RLS on `job_line_items` table
  - Add policies for authenticated users to manage job line items within their account
  
  ## Triggers
  
  ### `copy_estimate_line_items_on_approval`
  - Automatically copies estimate line items to job_line_items when estimate status changes to 'accepted'
  - Only copies if the estimate has a linked job_id
  - Preserves all line item details including sort order
  
  ### `copy_estimate_line_items_on_job_creation`
  - Checks if a job has an approved estimate when the job is created
  - Automatically copies line items from approved estimate to the job
  
  ## Important Notes
  - Job costs are copied from estimates only when approved
  - Line items maintain reference to original estimate line item via estimate_line_item_id
  - Changes to estimate line items after approval do not affect job line items
  - Job line items can be independently modified without affecting estimate
*/

-- Create job_line_items table
CREATE TABLE IF NOT EXISTS job_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'each',
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  estimate_line_item_id uuid REFERENCES estimate_line_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_line_items ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_line_items_lead_id ON job_line_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_job_line_items_account_id ON job_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_job_line_items_estimate_line_item_id ON job_line_items(estimate_line_item_id);

-- RLS Policies
CREATE POLICY "Users can view job line items in their account"
  ON job_line_items FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert job line items in their account"
  ON job_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update job line items in their account"
  ON job_line_items FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete job line items in their account"
  ON job_line_items FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Function to copy estimate line items to job line items
CREATE OR REPLACE FUNCTION copy_estimate_line_items_to_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_account_id uuid;
BEGIN
  -- Check if estimate status changed to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    v_job_id := NEW.job_id;
    v_account_id := NEW.account_id;
    
    -- Only proceed if estimate has a linked job
    IF v_job_id IS NOT NULL THEN
      -- Check if job line items already exist for this job
      -- (to avoid duplicates if estimate is re-approved)
      IF NOT EXISTS (
        SELECT 1 FROM job_line_items 
        WHERE lead_id = v_job_id
      ) THEN
        -- Copy all estimate line items to job line items
        INSERT INTO job_line_items (
          lead_id,
          name,
          description,
          quantity,
          unit,
          unit_price,
          total,
          sort_order,
          account_id,
          estimate_line_item_id
        )
        SELECT
          v_job_id,
          name,
          description,
          quantity,
          unit,
          unit_price,
          total,
          sort_order,
          v_account_id,
          id
        FROM estimate_line_items
        WHERE estimate_id = NEW.id
        AND is_change_order = false
        ORDER BY sort_order;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for when estimate is approved
DROP TRIGGER IF EXISTS trigger_copy_estimate_items_on_approval ON estimates;
CREATE TRIGGER trigger_copy_estimate_items_on_approval
  AFTER UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION copy_estimate_line_items_to_job();

-- Function to check and copy line items when job is created
CREATE OR REPLACE FUNCTION copy_estimate_items_on_job_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estimate_id uuid;
  v_estimate_status text;
  v_account_id uuid;
BEGIN
  -- Get the estimate for this job (if any)
  SELECT id, status, account_id
  INTO v_estimate_id, v_estimate_status, v_account_id
  FROM estimates
  WHERE job_id = NEW.id
  LIMIT 1;
  
  -- If there's an approved estimate, copy its line items
  IF v_estimate_id IS NOT NULL AND v_estimate_status = 'accepted' THEN
    -- Check if line items don't already exist
    IF NOT EXISTS (
      SELECT 1 FROM job_line_items 
      WHERE lead_id = NEW.id
    ) THEN
      -- Copy line items
      INSERT INTO job_line_items (
        lead_id,
        name,
        description,
        quantity,
        unit,
        unit_price,
        total,
        sort_order,
        account_id,
        estimate_line_item_id
      )
      SELECT
        NEW.id,
        name,
        description,
        quantity,
        unit,
        unit_price,
        total,
        sort_order,
        v_account_id,
        id
      FROM estimate_line_items
      WHERE estimate_id = v_estimate_id
      AND is_change_order = false
      ORDER BY sort_order;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for when job is created
DROP TRIGGER IF EXISTS trigger_copy_estimate_items_on_job_creation ON leads;
CREATE TRIGGER trigger_copy_estimate_items_on_job_creation
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION copy_estimate_items_on_job_creation();