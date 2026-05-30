/*
  # Add surcharge column to estimates

  1. Modified Tables
    - `estimates`
      - `surcharge` (numeric, default 0) - Surcharge percentage applied to the estimate subtotal

  2. Notes
    - Similar to profit_margin, this is a percentage stored on each estimate
    - Applied on top of subtotal before tax calculation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'surcharge'
  ) THEN
    ALTER TABLE estimates ADD COLUMN surcharge numeric DEFAULT 0;

  END IF;

END $$;
;
