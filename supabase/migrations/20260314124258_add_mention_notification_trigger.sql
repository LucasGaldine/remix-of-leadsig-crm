/*
  # Add mention notification trigger

  1. New Functions
    - `extract_mentioned_users(text)` - Extracts user IDs from @mentions in text
    - `handle_mention_notifications()` - Trigger function that creates notifications for mentioned users

  2. New Triggers
    - `trigger_mention_notifications` on `interactions` - Fires when a note is created with mentions

  3. Important Notes
    - Mentions use the format @[Name](user-id)
    - Only sends notifications to users who have mention_notifications_enabled = true
    - Creates a notification for each mentioned user
    - Only triggers for 'note' type interactions
*/

CREATE OR REPLACE FUNCTION extract_mentioned_users(note_text text)
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  user_ids uuid[];
  match_array text[];
BEGIN
  SELECT array_agg(DISTINCT m[2]::uuid)
  INTO user_ids
  FROM regexp_matches(note_text, '@\[([^\]]+)\]\(([a-f0-9-]+)\)', 'g') AS m
  WHERE m[2] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$';
  
  RETURN COALESCE(user_ids, ARRAY[]::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION handle_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user_id uuid;
  mentioned_user_ids uuid[];
  lead_data record;
  author_name text;
BEGIN
  IF NEW.type != 'note' THEN
    RETURN NEW;
  END IF;

  mentioned_user_ids := extract_mentioned_users(COALESCE(NEW.body, NEW.summary, ''));

  IF array_length(mentioned_user_ids, 1) IS NULL OR array_length(mentioned_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT name, customer_id INTO lead_data
  FROM leads
  WHERE id = NEW.lead_id;

  SELECT full_name INTO author_name
  FROM profiles
  WHERE user_id = NEW.created_by
  LIMIT 1;

  FOREACH mentioned_user_id IN ARRAY mentioned_user_ids
  LOOP
    IF mentioned_user_id != NEW.created_by THEN
      INSERT INTO notifications (
        user_id,
        account_id,
        type,
        title,
        message,
        link,
        metadata
      )
      SELECT
        mentioned_user_id,
        NEW.account_id,
        'mention',
        COALESCE(author_name, 'Someone') || ' mentioned you in a note',
        substring(regexp_replace(COALESCE(NEW.body, NEW.summary, ''), '@\[([^\]]+)\]\([a-f0-9-]+\)', '@\1', 'g'), 1, 100),
        '/jobs/' || NEW.lead_id,
        jsonb_build_object(
          'lead_id', NEW.lead_id,
          'interaction_id', NEW.id,
          'mentioned_by', NEW.created_by
        )
      FROM profiles
      WHERE user_id = mentioned_user_id
        AND mention_notifications_enabled = true;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_mention_notifications'
  ) THEN
    CREATE TRIGGER trigger_mention_notifications
      AFTER INSERT ON interactions
      FOR EACH ROW
      EXECUTE FUNCTION handle_mention_notifications();
  END IF;
END $$;
