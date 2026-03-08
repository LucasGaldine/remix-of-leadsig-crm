/*
  # Add pricing plan to accounts

  1. Modified Tables
    - `accounts`
      - `pricing_plan` (text, default 'free') - The company's current subscription plan (free, basic, premium)

  2. Notes
    - Defaults to 'free' for all existing and new accounts
    - Constrained to only allow valid plan values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'pricing_plan'
  ) THEN
    ALTER TABLE accounts ADD COLUMN pricing_plan text NOT NULL DEFAULT 'free';
    ALTER TABLE accounts ADD CONSTRAINT accounts_pricing_plan_check
      CHECK (pricing_plan IN ('free', 'basic', 'premium'));
  END IF;
END $$;
