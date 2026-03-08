/*
  # Add Lead Source Setup Sessions

  1. New Tables
    - `lead_source_setup_sessions`
      - `id` (uuid, primary key) - The setup session token
      - `account_id` (uuid, foreign key to accounts)
      - `user_id` (uuid, foreign key to auth.users)
      - `platform` (text) - The platform being configured (e.g., "google")
      - `test_payload` (jsonb) - The test data received from the platform
      - `received_at` (timestamptz) - When test data was received
      - `expires_at` (timestamptz) - When this session expires (10 minutes)
      - `created_at` (timestamptz)
      
  2. Changes
    - Add index on expires_at for cleanup queries
    - Add index on account_id and user_id for lookups
    
  3. Security
    - Enable RLS on `lead_source_setup_sessions` table
    - Add policy for users to read their own setup sessions
    - Add policy for users to insert their own setup sessions
    - Add policy for service role to update sessions (for webhook handler)
*/

-- Create lead_source_setup_sessions table
CREATE TABLE IF NOT EXISTS lead_source_setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  test_payload jsonb,
  received_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_setup_sessions_expires 
  ON lead_source_setup_sessions(expires_at);
  
CREATE INDEX IF NOT EXISTS idx_setup_sessions_account 
  ON lead_source_setup_sessions(account_id);
  
CREATE INDEX IF NOT EXISTS idx_setup_sessions_user 
  ON lead_source_setup_sessions(user_id);

-- Enable RLS
ALTER TABLE lead_source_setup_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own setup sessions
CREATE POLICY "Users can read own setup sessions"
  ON lead_source_setup_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own setup sessions
CREATE POLICY "Users can insert own setup sessions"
  ON lead_source_setup_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own setup sessions
CREATE POLICY "Users can delete own setup sessions"
  ON lead_source_setup_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to clean up expired setup sessions (runs periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_setup_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM lead_source_setup_sessions
  WHERE expires_at < now();
END;
$$;