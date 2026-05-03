/*
  # Add fallback SELECT/UPDATE policies for profile avatars

  Some storage upload flows may evaluate read/update paths depending on upsert
  behavior and runtime role resolution. This keeps avatar uploads resilient.
*/

DROP POLICY IF EXISTS "Public fallback select avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public fallback update avatars" ON storage.objects;

CREATE POLICY "Public fallback select avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'profiles'
  AND name LIKE 'avatars/%'
);

CREATE POLICY "Public fallback update avatars"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'profiles'
  AND name LIKE 'avatars/%'
)
WITH CHECK (
  bucket_id = 'profiles'
  AND name LIKE 'avatars/%'
);
