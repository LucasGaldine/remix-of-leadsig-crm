/*
  # Create quickbooks integrations table

  1. New Tables
    - `quickbooks_integrations`
      - `id` (uuid, primary key)
      - `account_id` (uuid, unique account reference)
      - `created_by` (uuid, references auth.users)
      - `realm_id` (text, QuickBooks company id)
      - `access_token` (text, OAuth access token)
      - `refresh_token` (text, OAuth refresh token)
      - `token_expires_at` (timestamptz, token expiry)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `quickbooks_integrations`
    - Allow account members to view and manage integration rows for their account
*/

CREATE TABLE IF NOT EXISTS quickbooks_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quickbooks_integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_quickbooks_integrations_account_id ON quickbooks_integrations(account_id);

DROP TRIGGER IF EXISTS update_quickbooks_integrations_updated_at ON quickbooks_integrations;
CREATE TRIGGER update_quickbooks_integrations_updated_at
  BEFORE UPDATE ON quickbooks_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Account members can view quickbooks integrations"
  ON quickbooks_integrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = quickbooks_integrations.account_id
      AND account_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Account members can create quickbooks integrations"
  ON quickbooks_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = quickbooks_integrations.account_id
      AND account_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Account members can update quickbooks integrations"
  ON quickbooks_integrations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = quickbooks_integrations.account_id
      AND account_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = quickbooks_integrations.account_id
      AND account_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Account owners and admins can delete quickbooks integrations"
  ON quickbooks_integrations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM account_members
      WHERE account_members.account_id = quickbooks_integrations.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role IN ('owner', 'admin')
    )
  );
