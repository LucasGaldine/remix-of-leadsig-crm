/*
  # Scope crew member notifications to assigned jobs only

  1. Updated Functions
    - `create_user_notifications` - now accepts optional `p_lead_id` parameter
      - For crew members (role = 'crew_member'): only creates notification if they
        are assigned to the referenced job via `job_assignments`
      - For owners/admins/crew_leads: behavior unchanged (receive all notifications)
    - `notify_job_scheduled` - now passes lead_id for crew scoping
    - `notify_lead_status_change` - now passes lead_id for crew scoping

  2. New Triggers
    - `notify_job_assignment_change` - fires on INSERT/DELETE on `job_assignments`
      - Creates in-app notification for the assigned/unassigned crew member
      - Respects user notification preferences (alert key: job_assignments)
    - `notify_sms_job_assignment` - fires on INSERT on `job_assignments`
      - Sends SMS via send-sms edge function to notify assigned crew member

  3. Notes
    - Crew members will only receive schedule_change and lead_update notifications
      for jobs they are assigned to
    - Job assignment/unassignment notifications are sent directly to the affected user
    - Owners, admins, and crew_leads continue to receive all notifications as before
*/

-- 1. Update create_user_notifications to scope crew to assigned jobs
CREATE OR REPLACE FUNCTION create_user_notifications(
  p_account_id uuid,
  p_title text,
  p_body text,
  p_event_type text,
  p_alert_key text,
  p_reference_id uuid,
  p_reference_type text,
  p_lead_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member RECORD;
  _prefs jsonb;
  _alert_enabled boolean;
  _is_crew boolean;
  _is_assigned boolean;
BEGIN
  FOR _member IN
    SELECT am.user_id, am.role, p.notification_preferences
    FROM account_members am
    LEFT JOIN profiles p ON p.user_id = am.user_id
    WHERE am.account_id = p_account_id
    AND am.is_active = true
  LOOP
    _is_crew := (_member.role = 'crew_member');

    IF _is_crew AND p_lead_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM job_assignments ja
        WHERE ja.lead_id = p_lead_id
        AND ja.user_id = _member.user_id
      ) INTO _is_assigned;

      IF NOT _is_assigned THEN
        CONTINUE;
      END IF;
    END IF;

    _prefs := _member.notification_preferences;
    _alert_enabled := true;

    IF _prefs IS NOT NULL
       AND _prefs->'alerts' IS NOT NULL
       AND _prefs->'alerts'->p_alert_key IS NOT NULL THEN
      _alert_enabled := (_prefs->'alerts'->>p_alert_key)::boolean;
    END IF;

    IF _alert_enabled THEN
      INSERT INTO notifications (account_id, user_id, title, body, event_type, reference_id, reference_type)
      VALUES (p_account_id, _member.user_id, p_title, p_body, p_event_type, p_reference_id, p_reference_type);
    END IF;
  END LOOP;
END;
$$;

-- 2. Update notify_job_scheduled to pass lead_id for crew scoping
CREATE OR REPLACE FUNCTION notify_job_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  PERFORM create_user_notifications(
    NEW.account_id,
    'Job Scheduled',
    COALESCE(_lead_name, 'Job') || ' scheduled for ' || NEW.scheduled_date::text,
    'schedule_change',
    'schedule_changes',
    NEW.lead_id,
    'job_schedule',
    NEW.lead_id
  );
  RETURN NEW;
END;
$$;

-- 3. Update notify_lead_status_change to pass lead_id for crew scoping
CREATE OR REPLACE FUNCTION notify_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM create_user_notifications(
    NEW.account_id,
    'Lead Status Updated',
    COALESCE(NEW.name, 'Lead') || ' moved to ' || NEW.status::text,
    'lead_status_change',
    'lead_updates',
    NEW.id,
    'lead',
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- 4. Add trigger for job assignment in-app notifications
CREATE OR REPLACE FUNCTION notify_job_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_name text;
  _prefs jsonb;
  _alert_enabled boolean;
  _target_user_id uuid;
  _target_account_id uuid;
  _target_lead_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _target_user_id := NEW.user_id;
    _target_account_id := NEW.account_id;
    _target_lead_id := NEW.lead_id;
  ELSIF TG_OP = 'DELETE' THEN
    _target_user_id := OLD.user_id;
    _target_account_id := OLD.account_id;
    _target_lead_id := OLD.lead_id;
  END IF;

  SELECT name INTO _lead_name FROM leads WHERE id = _target_lead_id;

  SELECT notification_preferences INTO _prefs
  FROM profiles WHERE user_id = _target_user_id;

  _alert_enabled := true;
  IF _prefs IS NOT NULL
     AND _prefs->'alerts' IS NOT NULL
     AND _prefs->'alerts'->'job_assignments' IS NOT NULL THEN
    _alert_enabled := (_prefs->'alerts'->>'job_assignments')::boolean;
  END IF;

  IF _alert_enabled THEN
    INSERT INTO notifications (account_id, user_id, title, body, event_type, reference_id, reference_type)
    VALUES (
      _target_account_id,
      _target_user_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'Job Assignment' ELSE 'Job Unassigned' END,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'You have been assigned to ' || COALESCE(_lead_name, 'a job')
        ELSE 'You have been removed from ' || COALESCE(_lead_name, 'a job')
      END,
      'job_assignment',
      _target_lead_id,
      'lead'
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  ELSE
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS on_job_assignment_change ON job_assignments;
CREATE TRIGGER on_job_assignment_change
  AFTER INSERT OR DELETE ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_job_assignment_change();

-- 5. Add SMS trigger for job assignment notifications
CREATE OR REPLACE FUNCTION notify_sms_job_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event_type', 'job_assignments',
      'account_id', NEW.account_id::text,
      'data', jsonb_build_object(
        'lead_id', NEW.lead_id::text,
        'lead_name', COALESCE(_lead_name, 'Job'),
        'user_id', NEW.user_id::text,
        'action', 'assigned'
      )
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_job_assignment_sms ON job_assignments;
CREATE TRIGGER on_job_assignment_sms
  AFTER INSERT ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_sms_job_assignment();