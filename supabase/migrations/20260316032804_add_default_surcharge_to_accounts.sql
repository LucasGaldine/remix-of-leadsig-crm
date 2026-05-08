/*\n  # Add default surcharge to accounts\n\n  1. Modified Tables\n    - `accounts`\n      - `default_surcharge` (numeric, default 0) - Default surcharge percentage applied to new estimates\n\n  2. Notes\n    - Works like profit margin: a percentage added to estimate totals\n    - Editable per estimate, with this as the default\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'accounts' AND column_name = 'default_surcharge'\n  ) THEN\n    ALTER TABLE accounts ADD COLUMN default_surcharge numeric DEFAULT 0;
\n  END IF;
\nEND $$;
;
