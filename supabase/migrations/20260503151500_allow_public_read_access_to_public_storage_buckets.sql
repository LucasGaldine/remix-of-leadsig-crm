/*
  # Allow read access to public storage buckets

  storage.buckets has RLS enabled. Without a SELECT policy, storage upload flows
  can fail with misleading storage.objects RLS errors during bucket checks.
*/

DROP POLICY IF EXISTS "Public can read public buckets" ON storage.buckets;

CREATE POLICY "Public can read public buckets"
ON storage.buckets FOR SELECT
TO public
USING (public = true);
