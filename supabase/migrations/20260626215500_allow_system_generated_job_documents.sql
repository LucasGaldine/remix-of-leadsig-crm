/*
  Allow signed/customer portal documents to be generated without an internal user uploader.

  job_documents.uploaded_by is still useful audit metadata for authenticated CRM uploads,
  but customer portal and service-role generated documents do not have an auth.users actor.
*/

ALTER TABLE public.job_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

DROP POLICY IF EXISTS "Account members can insert job documents" ON public.job_documents;
CREATE POLICY "Account members can insert job documents"
  ON public.job_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND (uploaded_by IS NULL OR uploaded_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Account members can update job documents" ON public.job_documents;
CREATE POLICY "Account members can update job documents"
  ON public.job_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())))
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND (uploaded_by IS NULL OR uploaded_by = (select auth.uid()))
  );
