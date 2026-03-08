/*
  # Add client share token to leads table

  1. Modified Tables
    - `leads`
      - `client_share_token` (uuid, unique, nullable) - Token for sharing job details with clients who don't have accounts

  2. Indexes
    - Partial index on `client_share_token` for fast lookups

  This enables sharing a public link with clients so they can view their job status,
  estimate, photos, and scheduled dates without needing a LeadSig account.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'client_share_token'
  ) THEN
    ALTER TABLE leads ADD COLUMN client_share_token uuid UNIQUE DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_client_share_token
  ON leads(client_share_token)
  WHERE client_share_token IS NOT NULL;
