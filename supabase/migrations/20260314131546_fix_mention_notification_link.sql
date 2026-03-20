/*
  # Fix mention notification link

  1. Changes
    - Update notification link from /jobs/ to /leads/ for lead mentions
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
        '/leads/' || NEW.lead_id,
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
