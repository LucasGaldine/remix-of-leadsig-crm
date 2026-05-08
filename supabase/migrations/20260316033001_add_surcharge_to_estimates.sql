/*\n  # Add surcharge column to estimates\n\n  1. Modified Tables\n    - `estimates`\n      - `surcharge` (numeric, default 0) - Surcharge percentage applied to the estimate subtotal\n\n  2. Notes\n    - Similar to profit_margin, this is a percentage stored on each estimate\n    - Applied on top of subtotal before tax calculation\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'estimates' AND column_name = 'surcharge'\n  ) THEN\n    ALTER TABLE estimates ADD COLUMN surcharge numeric DEFAULT 0;
\n  END IF;
\nEND $$;
;
