/*
  # Allow account members to manage website assets in profiles bucket

  Website hero/service images are stored in:
    profiles/website/{account_id}/...

  Existing policies only allow writes under profiles/avatars/*, which blocks
  website image uploads with RLS violations.
*/

DROP POLICY IF EXISTS "Account members can upload website assets" ON storage.objects;
DROP POLICY IF EXISTS "Account members can update website assets" ON storage.objects;
DROP POLICY IF EXISTS "Account members can delete website assets" ON storage.objects;

CREATE POLICY "Account members can upload website assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id::text = (storage.foldername(name))[2]
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  )
);

CREATE POLICY "Account members can update website assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id::text = (storage.foldername(name))[2]
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  )
)
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id::text = (storage.foldername(name))[2]
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  )
);

CREATE POLICY "Account members can delete website assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'website'
  AND EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id::text = (storage.foldername(name))[2]
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  )
);
