/*
  # Add preferred schedule day columns to recurring_jobs

  1. Modified Tables
    - `recurring_jobs`
      - `preferred_days_of_week` (jsonb) - array of integers 0-6 (Sun-Sat) for weekly/biweekly jobs
      - `preferred_day_of_month` (int) - day of month 1-31 for monthly jobs

  2. Notes
    - For weekly/biweekly: preferred_days_of_week stores which day(s) of the week the job recurs
    - For monthly: preferred_day_of_month stores which day of the month the job recurs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_jobs' AND column_name = 'preferred_days_of_week'
  ) THEN
    ALTER TABLE recurring_jobs ADD COLUMN preferred_days_of_week jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_jobs' AND column_name = 'preferred_day_of_month'
  ) THEN
    ALTER TABLE recurring_jobs ADD COLUMN preferred_day_of_month int;
  END IF;
END $$;
