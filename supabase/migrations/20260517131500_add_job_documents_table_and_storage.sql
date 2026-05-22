/*
  # Add Job Documents Table And Storage

  1. New table
    - `job_documents`
      - one document slot per lead + document type
      - supports estimate, job agreement, warranty, and job release attachments

  2. Storage
    - create `job-documents` bucket
    - enforce account-scoped upload/read/delete paths via first folder segment (account_id)

  3. Security
    - account members can view/create/update/delete their account's job documents
*/

CREATE TABLE IF NOT EXISTS public.job_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type = ANY (ARRAY['estimate', 'job_agreement', 'warranty', 'job_release'])),
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_documents_lead_document_type_key UNIQUE (lead_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_job_documents_account_id ON public.job_documents (account_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_lead_id ON public.job_documents (lead_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_document_type ON public.job_documents (document_type);

ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view job documents" ON public.job_documents;
CREATE POLICY "Account members can view job documents"
  ON public.job_documents
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Account members can insert job documents" ON public.job_documents;
CREATE POLICY "Account members can insert job documents"
  ON public.job_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND uploaded_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Account members can update job documents" ON public.job_documents;
CREATE POLICY "Account members can update job documents"
  ON public.job_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())))
  WITH CHECK (
    public.is_account_member(account_id, (select auth.uid()))
    AND uploaded_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Account members can delete job documents" ON public.job_documents;
CREATE POLICY "Account members can delete job documents"
  ON public.job_documents
  FOR DELETE
  TO authenticated
  USING (public.is_account_member(account_id, (select auth.uid())));

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Account members can upload job documents files" ON storage.objects;
CREATE POLICY "Account members can upload job documents files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-documents'
    AND public.is_account_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Account members can view job documents files" ON storage.objects;
CREATE POLICY "Account members can view job documents files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-documents'
    AND public.is_account_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Account members can delete job documents files" ON storage.objects;
CREATE POLICY "Account members can delete job documents files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-documents'
    AND public.is_account_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );
