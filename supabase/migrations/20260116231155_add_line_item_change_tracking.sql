/*
  # Add Change Order Tracking to Estimate Line Items

  1. Changes to `estimate_line_items` table
    - Add `is_change_order` boolean to mark items that are change orders
    - Add `change_order_type` enum to track type of change (added, edited, deleted)
    - Add `original_line_item_id` to reference the original item being replaced
    - Add `change_order_notes` for additional context about the change
    - Add `changed_at` timestamp to track when the change occurred
    
  2. Security
    - No RLS changes needed, inherits from parent table policies
*/

-- Create enum for change order types
DO $$ BEGIN
  CREATE TYPE change_order_type AS ENUM ('added', 'edited', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add change order tracking columns to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'is_change_order'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN is_change_order boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'change_order_type'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN change_order_type change_order_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'original_line_item_id'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN original_line_item_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'change_order_notes'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN change_order_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'changed_at'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN changed_at timestamptz;
  END IF;
END $$;

-- Add foreign key for original_line_item_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estimate_line_items_original_line_item_id_fkey'
  ) THEN
    ALTER TABLE estimate_line_items
      ADD CONSTRAINT estimate_line_items_original_line_item_id_fkey
      FOREIGN KEY (original_line_item_id)
      REFERENCES estimate_line_items(id)
      ON DELETE SET NULL;
  END IF;
END $$;