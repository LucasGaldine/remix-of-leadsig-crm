/*
  # Add default tax rate to accounts

  1. Modified Tables
    - `accounts`
      - `default_tax_rate` (numeric(5,2), default 8.00) - the company's default tax percentage (e.g. 8.00 = 8%)

  2. Notes
    - Stored as a percentage (not decimal) for readability
    - Used as the default tax rate when creating new estimates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'default_tax_rate'
  ) THEN
    ALTER TABLE accounts ADD COLUMN default_tax_rate numeric(5,2) DEFAULT 8.00 NOT NULL;
  END IF;
END $$;
