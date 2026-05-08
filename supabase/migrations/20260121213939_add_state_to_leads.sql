/*\n  # Add State Column to Leads Table\n  \n  ## Overview\n  Adds a state column to the leads table to support full address information.\n  \n  ## Changes\n  - Add state column (text) to leads table\n  - Column is optional (nullable) for backwards compatibility\n  \n  ## Notes\n  - Existing records will have null for state\n  - Frontend can optionally populate this field\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'leads' AND column_name = 'state'\n  ) THEN\n    ALTER TABLE leads ADD COLUMN state text;
\n  END IF;
\nEND $$;
;
