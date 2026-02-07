/*
  # Add declined status to estimate_status enum

  1. Changes
    - Adds 'declined' value to the `estimate_status` enum type
    - This allows estimates to be declined by clients via the client portal

  2. Notes
    - Non-destructive change, only adds a new enum value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'estimate_status'::regtype
    AND enumlabel = 'declined'
  ) THEN
    ALTER TYPE estimate_status ADD VALUE 'declined';
  END IF;
END $$;
