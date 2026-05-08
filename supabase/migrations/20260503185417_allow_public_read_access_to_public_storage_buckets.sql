DROP POLICY IF EXISTS "Public can read public buckets" ON storage.buckets;

CREATE POLICY "Public can read public buckets"
ON storage.buckets FOR SELECT
TO public
USING (public = true);;
