/*
  # Add dashboard preferences column to profiles

  1. Modified Tables
    - `profiles`
      - Added `dashboard_preferences` (jsonb) - stores user's chosen dashboard stat cards
        - `cards`: array of card IDs to display on the dashboard
        - Default: ["leads_pending", "pending_approvals", "qualified_leads"]

  2. Notes
    - Uses IF NOT EXISTS check to prevent errors on re-run
    - Default value matches the current hardcoded dashboard stat cards
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dashboard_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dashboard_preferences jsonb DEFAULT '{"cards": ["leads_pending", "pending_approvals", "qualified_leads"]}'::jsonb;
  END IF;
END $$;
