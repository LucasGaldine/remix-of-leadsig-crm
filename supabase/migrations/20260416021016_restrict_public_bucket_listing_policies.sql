/*
  # Restrict public bucket file listing

  1. Security Changes
    - Drop broad SELECT policy on `lead-photos` bucket that allowed anyone to list all files
    - Drop broad SELECT policy on `profiles` bucket that allowed anyone to list all files
    - Public buckets serve files by direct URL without needing SELECT policies,
      so removing these prevents unintended exposure of file listings

  2. Important Notes
    - Direct URL access to files in public buckets is unaffected
    - Upload, update, and delete policies remain unchanged
*/

DROP POLICY IF EXISTS "Anyone can view lead photos" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

;
