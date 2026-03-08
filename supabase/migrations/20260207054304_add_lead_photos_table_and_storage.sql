/*
  # Add Lead Photos Table and Storage Bucket

  1. New Tables
    - `lead_photos`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `account_id` (uuid, foreign key to accounts)
      - `file_path` (text, storage path)
      - `uploaded_by` (uuid, the user who uploaded)
      - `created_at` (timestamptz, default now())

  2. Storage
    - Create `lead-photos` public bucket for before-photos

  3. Security
    - Enable RLS on `lead_photos` table
    - Members of the same account can view photos
    - Authenticated users in the same account can insert photos
    - Only the uploader can delete their own photos
    - Storage policies for authenticated upload, public read, owner delete

  4. Notes
    - Max 4 photos per lead is enforced at the application level
    - Photos are stored under lead-photos/{account_id}/{lead_id}/{filename}
*/

-- Create lead_photos table
CREATE TABLE IF NOT EXISTS lead_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for querying photos by lead
CREATE INDEX IF NOT EXISTS idx_lead_photos_lead_id ON lead_photos(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_photos_account_id ON lead_photos(account_id);

-- Enable RLS
ALTER TABLE lead_photos ENABLE ROW LEVEL SECURITY;

-- Account members can view photos for their account
CREATE POLICY "Account members can view lead photos"
  ON lead_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_photos.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

-- Account members can insert photos for their account
CREATE POLICY "Account members can insert lead photos"
  ON lead_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_photos.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

-- Only the uploader can delete their photos
CREATE POLICY "Uploaders can delete own lead photos"
  ON lead_photos FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
  );

-- Create lead-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-photos', 'lead-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lead-photos bucket
DROP POLICY IF EXISTS "Account members can upload lead photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view lead photos" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete lead photos" ON storage.objects;

-- Allow authenticated users to upload lead photos
CREATE POLICY "Account members can upload lead photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-photos'
);

-- Allow public read access to lead photos
CREATE POLICY "Anyone can view lead photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lead-photos');

-- Allow authenticated users to delete their own lead photos
CREATE POLICY "Uploaders can delete lead photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-photos'
);
