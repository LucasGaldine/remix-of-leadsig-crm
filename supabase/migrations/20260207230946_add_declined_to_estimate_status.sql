/*\n  # Add declined status to estimate_status enum\n\n  1. Changes\n    - Adds 'declined' value to the `estimate_status` enum type\n    - This allows estimates to be declined by clients via the client portal\n\n  2. Notes\n    - Non-destructive change, only adds a new enum value\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_enum\n    WHERE enumtypid = 'estimate_status'::regtype\n    AND enumlabel = 'declined'\n  ) THEN\n    ALTER TYPE estimate_status ADD VALUE 'declined';
\n  END IF;
\nEND $$;
\n;
