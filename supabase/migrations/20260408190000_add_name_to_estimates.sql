/*
  # Add optional name to estimates

  This supports custom estimate names entered from the estimate builder UI.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'estimates'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.estimates
      ADD COLUMN name text;
  END IF;
END $$;
