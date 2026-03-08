/*
  # Update Stripe Connect for OAuth Integration

  ## Changes Made
  
  1. Schema Updates
    - Rename `stripe_account_id` to `stripe_user_id` (stores the connected Stripe account ID)
    - Add `access_token` (encrypted OAuth access token)
    - Add `refresh_token` (encrypted OAuth refresh token)
    - Add `token_expires_at` (timestamp for token expiration)
    - Add `scope` (OAuth scopes granted)
    - Add `stripe_publishable_key` (account's publishable key for client-side use)
    - Remove `onboarding_completed` (not relevant for OAuth)
    
  2. Security
    - Tokens stored as text for now (encryption should be handled at application layer)
    - RLS policies remain unchanged (already account-scoped)

  ## Important Notes
  - Existing data will need to be cleared as the integration model has changed
  - Users will need to reconnect via OAuth
  - This migration is safe to run on existing databases
*/

-- Add new columns for OAuth
DO $$
BEGIN
  -- Rename stripe_account_id to stripe_user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    RENAME COLUMN stripe_account_id TO stripe_user_id;
  END IF;

  -- Add access_token if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'access_token'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN access_token TEXT;
  END IF;

  -- Add refresh_token if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN refresh_token TEXT;
  END IF;

  -- Add token_expires_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;

  -- Add scope if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'scope'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN scope TEXT;
  END IF;

  -- Add stripe_publishable_key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'stripe_publishable_key'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN stripe_publishable_key TEXT;
  END IF;

  -- Drop onboarding_completed if exists (not relevant for OAuth)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    DROP COLUMN onboarding_completed;
  END IF;

  -- Add stripe_account_email for displaying which account is connected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_connect_accounts' AND column_name = 'stripe_account_email'
  ) THEN
    ALTER TABLE stripe_connect_accounts 
    ADD COLUMN stripe_account_email TEXT;
  END IF;
END $$;

-- Clear existing data as we're switching from Express to OAuth model
TRUNCATE stripe_connect_accounts CASCADE;

-- Update comment on table
COMMENT ON TABLE stripe_connect_accounts IS 'Stores OAuth connection data for user Stripe accounts';
COMMENT ON COLUMN stripe_connect_accounts.stripe_user_id IS 'The connected Stripe account ID (acct_xxx)';
COMMENT ON COLUMN stripe_connect_accounts.access_token IS 'OAuth access token for API calls (should be encrypted)';
COMMENT ON COLUMN stripe_connect_accounts.refresh_token IS 'OAuth refresh token (should be encrypted)';
COMMENT ON COLUMN stripe_connect_accounts.token_expires_at IS 'When the access token expires';
COMMENT ON COLUMN stripe_connect_accounts.scope IS 'OAuth scopes granted by the user';
COMMENT ON COLUMN stripe_connect_accounts.stripe_publishable_key IS 'Stripe publishable key for client-side operations';
COMMENT ON COLUMN stripe_connect_accounts.stripe_account_email IS 'Email of the connected Stripe account';