/*
  # Allow self-mentions in notifications

  1. Changes
    - Remove the check that prevents users from being notified about their own mentions
    - Users can now @ themselves to create personal reminders
*/

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
    INSERT INTO notifications (
      user_id,
      account_id,
      event_type,
      title,
      body,
      reference_id,
      reference_type
    )
    SELECT
      mentioned_user_id,
      NEW.account_id,
      'mention',
      COALESCE(author_name, 'Someone') || ' mentioned you in a note',
      substring(regexp_replace(COALESCE(NEW.body, NEW.summary, ''), '@\[([^\]]+)\]\([a-f0-9-]+\)', '@\1', 'g'), 1, 100),
      NEW.lead_id,
      'lead'
    FROM profiles
    WHERE user_id = mentioned_user_id
      AND mention_notifications_enabled = true;
  END LOOP;

  RETURN NEW;
END;
$$;
