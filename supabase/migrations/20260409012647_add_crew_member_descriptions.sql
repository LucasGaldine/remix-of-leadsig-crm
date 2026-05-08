/*
  # Add Crew Member Descriptions

  ## Overview
  Adds short optional descriptions to signed and mock crew members for use in
  Settings > Crew Management.

  ## Changes
  - Adds `description` column to `account_members`.
  - Adds `description` column to `mock_crew_profiles`.
  - Adds max length checks to keep descriptions short.
*/

ALTER TABLE public.account_members
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.mock_crew_profiles
ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_members_description_length_check'
    AND conrelid = 'public.account_members'::regclass
  ) THEN
    ALTER TABLE public.account_members
    ADD CONSTRAINT account_members_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 160);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mock_crew_profiles_description_length_check'
    AND conrelid = 'public.mock_crew_profiles'::regclass
  ) THEN
    ALTER TABLE public.mock_crew_profiles
    ADD CONSTRAINT mock_crew_profiles_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 160);
  END IF;
END $$;;
