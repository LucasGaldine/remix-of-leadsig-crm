DROP POLICY IF EXISTS "Account members can view website assets" ON storage.objects;

CREATE POLICY "Account members can view website assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);;
