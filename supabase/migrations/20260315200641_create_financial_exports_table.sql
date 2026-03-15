/*
  # Create financial exports table

  1. New Tables
    - `financial_exports`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references accounts)
      - `created_by` (uuid, references auth.users)
      - `filename` (text, the generated filename)
      - `date_from` (date, start of export range)
      - `date_to` (date, end of export range)
      - `record_count` (integer, number of rows exported)
      - `export_type` (text, e.g. 'invoices', 'payments', 'full')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `financial_exports` table
    - Add policies for authenticated users to manage their own account exports
*/

CREATE TABLE IF NOT EXISTS financial_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  filename text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  export_type text NOT NULL DEFAULT 'full',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_exports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_financial_exports_account_id ON financial_exports(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_exports_created_by ON financial_exports(created_by);

CREATE POLICY "Account members can view financial exports"
  ON financial_exports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = financial_exports.account_id
      AND account_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Account members can create financial exports"
  ON financial_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = financial_exports.account_id
      AND account_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Export creators can delete their own exports"
  ON financial_exports
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
