/*
  # Add mention notifications setting

  1. Changes
    - Add `mention_notifications_enabled` column to profiles table
    - Defaults to true (enabled)
    - Users can toggle this in their notification settings

  2. Important Notes
    - When someone is @mentioned in a note, they'll receive a notification if this is enabled
    - This setting is per-user, allowing individual control over mention notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'mention_notifications_enabled'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN mention_notifications_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;
