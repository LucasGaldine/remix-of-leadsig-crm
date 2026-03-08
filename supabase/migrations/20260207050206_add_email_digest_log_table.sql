/*
  # Add email digest log table

  1. New Tables
    - `email_digest_log`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references accounts)
      - `user_id` (uuid, references auth.users)
      - `email_to` (text, recipient email)
      - `digest_type` (text, 'daily' or 'weekly')
      - `notification_count` (integer, how many notifications were included)
      - `status` (text, 'sent', 'failed', 'skipped')
      - `error_message` (text, nullable)
      - `period_start` (timestamptz, start of digest period)
      - `period_end` (timestamptz, end of digest period)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `email_digest_log`
    - Account members can view their account's digest logs

  3. Notes
    - Used by the send-email-digest edge function to track delivery
    - Prevents duplicate sends by checking last digest time per user
*/

CREATE TABLE IF NOT EXISTS email_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email_to text NOT NULL DEFAULT '',
  digest_type text NOT NULL DEFAULT 'daily',
  notification_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_digest_log_account_id ON email_digest_log(account_id);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_user_id ON email_digest_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_created_at ON email_digest_log(created_at DESC);

ALTER TABLE email_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view digest logs"
  ON email_digest_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = email_digest_log.account_id
      AND account_members.user_id = auth.uid()
    )
  );
