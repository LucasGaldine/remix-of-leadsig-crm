/*
  # Fallback policy for profile avatar uploads

  Unblocks profile avatar uploads when Storage requests are evaluated under
  `public` role despite valid app auth context.

  Scope is constrained to:
  - profiles bucket
  - avatars/ prefix
  - single-level object name under avatars/
*/

DROP POLICY IF EXISTS "Public fallback upload avatars" ON storage.objects;

CREATE POLICY "Public fallback upload avatars"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'profiles'
  AND name LIKE 'avatars/%'
  AND position('/' in substring(name from 9)) = 0
);
