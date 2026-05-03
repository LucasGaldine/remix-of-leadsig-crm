/*
  # Fix profile avatar upload policy for Storage role variants

  Some Storage upload requests can evaluate as `public` role while still carrying
  a valid JWT (`auth.uid()` present), causing `TO authenticated`-only INSERT
  policies to fail with:
    new row violates row-level security policy

  This policy keeps uploads restricted to signed-in users and avatar paths while
  making role matching resilient.
*/

DROP POLICY IF EXISTS "Authenticated users can upload avatars robust" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars robust"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);
