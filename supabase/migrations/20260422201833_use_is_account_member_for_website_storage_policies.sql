DROP POLICY IF EXISTS "Account members can upload website assets" ON storage.objects;
DROP POLICY IF EXISTS "Account members can update website assets" ON storage.objects;
DROP POLICY IF EXISTS "Account members can delete website assets" ON storage.objects;

CREATE POLICY "Account members can upload website assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);

CREATE POLICY "Account members can update website assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid, (select auth.uid()))
)
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);

CREATE POLICY "Account members can delete website assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);;
