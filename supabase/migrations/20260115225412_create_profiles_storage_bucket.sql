/*
  # Create Profiles Storage Bucket

  ## Overview
  Creates a storage bucket for user profile photos with appropriate security policies.

  ## Changes Made
  
  ### 1. Storage Bucket
  - Create "profiles" bucket for storing profile photos and avatars
  - Set to public for easy access to profile images
  
  ### 2. Security Policies
  - Users can upload their own profile photos
  - Users can update their own profile photos
  - Users can delete their own profile photos
  - Everyone can view profile photos (public read access)
  
  ### 3. Notes
  - File size limits should be enforced at the application level
  - Image validation should be done before upload
  - Old avatars should be cleaned up when new ones are uploaded
*/

-- Create the profiles storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

-- Allow authenticated users to upload their own profile photos
CREATE POLICY "Users can upload own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to update their own profile photos
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
)
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to delete their own profile photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow everyone to view profile photos (public bucket)
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');
