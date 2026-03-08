/*
  # Add SMS notification logging and pg_net extension

  1. Extensions
    - Enable `pg_net` for making HTTP calls from database triggers

  2. New Tables
    - `sms_notification_log`
      - `id` (uuid, primary key)
      - `account_id` (uuid, FK to accounts)
      - `user_id` (uuid, FK to auth.users) - the recipient
      - `event_type` (text) - e.g., new_leads, lead_updates, payments, schedule_changes, tasks
      - `phone_to` (text) - the phone number the SMS was sent to
      - `message_body` (text) - the SMS content
      - `status` (text) - sent, failed, queued
      - `error_message` (text, nullable) - error details if failed
      - `twilio_sid` (text, nullable) - Twilio message SID for tracking
      - `metadata` (jsonb, nullable) - extra event data
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on sms_notification_log
    - Account members can view their own account's logs
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS sms_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL DEFAULT '',
  phone_to text NOT NULL DEFAULT '',
  message_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  twilio_sid text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sms_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view SMS logs"
  ON sms_notification_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = sms_notification_log.account_id
      AND account_members.user_id = (SELECT auth.uid())
      AND account_members.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_sms_notification_log_account_id ON sms_notification_log(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_notification_log_created_at ON sms_notification_log(created_at);
