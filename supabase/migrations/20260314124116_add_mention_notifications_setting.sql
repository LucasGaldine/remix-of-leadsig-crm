/*\n  # Add mention notifications setting\n\n  1. Changes\n    - Add `mention_notifications_enabled` column to profiles table\n    - Defaults to true (enabled)\n    - Users can toggle this in their notification settings\n\n  2. Important Notes\n    - When someone is @mentioned in a note, they'll receive a notification if this is enabled\n    - This setting is per-user, allowing individual control over mention notifications\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'profiles' AND column_name = 'mention_notifications_enabled'\n  ) THEN\n    ALTER TABLE profiles\n    ADD COLUMN mention_notifications_enabled boolean NOT NULL DEFAULT true;
\n  END IF;
\nEND $$;
\n;
