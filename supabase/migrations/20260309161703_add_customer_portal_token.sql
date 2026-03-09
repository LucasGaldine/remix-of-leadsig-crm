/*
  # Add client portal token to customers table

  1. Modified Tables
    - `customers`
      - `client_portal_token` (uuid, unique, nullable) - Token for sharing customer portal with clients

  2. Indexes
    - Partial index on `client_portal_token` for fast lookups

  This enables sharing a single portal link with clients that gives access to all their jobs,
  making it easier for customers to track all their work in one place.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'client_portal_token'
  ) THEN
    ALTER TABLE customers ADD COLUMN client_portal_token uuid UNIQUE DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_client_portal_token
  ON customers(client_portal_token)
  WHERE client_portal_token IS NOT NULL;
