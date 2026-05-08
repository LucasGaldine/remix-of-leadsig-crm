/*\n  # Add default tax rate to accounts\n\n  1. Modified Tables\n    - `accounts`\n      - `default_tax_rate` (numeric(5,2), default 8.00) - the company's default tax percentage (e.g. 8.00 = 8%)\n\n  2. Notes\n    - Stored as a percentage (not decimal) for readability\n    - Used as the default tax rate when creating new estimates\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'accounts' AND column_name = 'default_tax_rate'\n  ) THEN\n    ALTER TABLE accounts ADD COLUMN default_tax_rate numeric(5,2) DEFAULT 8.00 NOT NULL;
\n  END IF;
\nEND $$;
\n;
