/*
  # Add State Column to Leads Table
  
  ## Overview
  Adds a state column to the leads table to support full address information.
  
  ## Changes
  - Add state column (text) to leads table
  - Column is optional (nullable) for backwards compatibility
  
  ## Notes
  - Existing records will have null for state
  - Frontend can optionally populate this field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'state'
  ) THEN
    ALTER TABLE leads ADD COLUMN state text;
  END IF;
END $$;