DROP POLICY IF EXISTS "TEMP authenticated website upload probe" ON storage.objects;

CREATE POLICY "TEMP authenticated website upload probe"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
);;
