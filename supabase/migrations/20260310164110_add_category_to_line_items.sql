/*
  # Add Category to Line Items

  ## Overview
  Add a category field to both estimate_line_items and job_line_items to classify costs
  as equipment, materials, labor, or other.

  ## Changes

  ### 1. New Type
  - Create `line_item_category` enum with values: equipment, materials, labor, other

  ### 2. Modified Tables
  
  #### `estimate_line_items`
  - Add `category` column (line_item_category, default 'other')

  #### `job_line_items`
  - Add `category` column (line_item_category, default 'other')

  ## Important Notes
  - Category defaults to 'other' for backward compatibility with existing line items
  - Category is preserved when estimate line items are copied to job line items
  - Category helps track cost breakdown by type
*/

-- Create line item category enum
DO $$ BEGIN
  CREATE TYPE line_item_category AS ENUM ('equipment', 'materials', 'labor', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add category column to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'category'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN category line_item_category DEFAULT 'other' NOT NULL;
  END IF;
END $$;

-- Add category column to job_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_line_items' AND column_name = 'category'
  ) THEN
    ALTER TABLE job_line_items ADD COLUMN category line_item_category DEFAULT 'other' NOT NULL;
  END IF;
END $$;