/*
  # Add manual approval photo URL to estimates

  1. Changes
    - Add `manual_approval_photo_url` to `estimates`
    - Stores an optional public URL for the signature photo captured during manual approval
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'estimates'
      AND column_name = 'manual_approval_photo_url'
  ) THEN
    ALTER TABLE public.estimates
      ADD COLUMN manual_approval_photo_url text DEFAULT NULL;
  END IF;
END $$;
