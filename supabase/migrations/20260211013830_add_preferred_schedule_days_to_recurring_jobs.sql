/*\n  # Add preferred schedule day columns to recurring_jobs\n\n  1. Modified Tables\n    - `recurring_jobs`\n      - `preferred_days_of_week` (jsonb) - array of integers 0-6 (Sun-Sat) for weekly/biweekly jobs\n      - `preferred_day_of_month` (int) - day of month 1-31 for monthly jobs\n\n  2. Notes\n    - For weekly/biweekly: preferred_days_of_week stores which day(s) of the week the job recurs\n    - For monthly: preferred_day_of_month stores which day of the month the job recurs\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'recurring_jobs' AND column_name = 'preferred_days_of_week'\n  ) THEN\n    ALTER TABLE recurring_jobs ADD COLUMN preferred_days_of_week jsonb DEFAULT '[]'::jsonb;
\n  END IF;
\nEND $$;
\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'recurring_jobs' AND column_name = 'preferred_day_of_month'\n  ) THEN\n    ALTER TABLE recurring_jobs ADD COLUMN preferred_day_of_month int;
\n  END IF;
\nEND $$;
\n;
