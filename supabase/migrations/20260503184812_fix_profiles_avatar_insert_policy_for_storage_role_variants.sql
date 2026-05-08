DROP POLICY IF EXISTS "Authenticated users can upload avatars robust" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars robust"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);;
