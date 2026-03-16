/*
  # Add default surcharge to accounts

  1. Modified Tables
    - `accounts`
      - `default_surcharge` (numeric, default 0) - Default surcharge percentage applied to new estimates

  2. Notes
    - Works like profit margin: a percentage added to estimate totals
    - Editable per estimate, with this as the default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'default_surcharge'
  ) THEN
    ALTER TABLE accounts ADD COLUMN default_surcharge numeric DEFAULT 0;
  END IF;
END $$;