/*
  # Add foreign key relationship between lead_photos and profiles

  1. Changes
    - Add foreign key constraint from lead_photos.uploaded_by to profiles.user_id
    - This allows PostgREST to properly join lead_photos with profiles table

  2. Important Notes
    - This enables the query: lead_photos.select('*, uploader:profiles(full_name)')
    - The uploaded_by column references auth.users, but profiles.user_id also references auth.users
    - This creates a valid path for PostgREST to traverse
*/

-- Add foreign key constraint to enable PostgREST relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lead_photos_uploaded_by_profiles_fkey'
    AND table_name = 'lead_photos'
  ) THEN
    ALTER TABLE lead_photos
    ADD CONSTRAINT lead_photos_uploaded_by_profiles_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES profiles(user_id);
  END IF;
END $$;
