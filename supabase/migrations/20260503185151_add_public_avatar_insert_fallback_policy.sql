DROP POLICY IF EXISTS "Public fallback upload avatars" ON storage.objects;

CREATE POLICY "Public fallback upload avatars"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'profiles'
  AND name LIKE 'avatars/%'
  AND position('/' in substring(name from 9)) = 0
);;
