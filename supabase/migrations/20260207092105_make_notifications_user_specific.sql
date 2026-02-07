/*
  # Make notifications user-specific based on user settings

  1. Schema Changes
    - Add `user_id` (uuid, nullable, FK to auth.users) column to `notifications` table
    - Backfill existing notifications by assigning them to the account owner

  2. New Functions
    - `create_user_notifications` - helper that loops over active account members,
      checks each user's notification_preferences for the relevant alert key,
      and inserts a notification only for users who have that alert enabled

  3. Updated Trigger Functions
    - `notify_new_lead` - now creates per-user notifications (alert key: new_leads)
    - `notify_lead_status_change` - now creates per-user notifications (alert key: lead_updates)
    - `notify_payment_received` - now creates per-user notifications (alert key: payments)
    - `notify_job_scheduled` - now creates per-user notifications (alert key: schedule_changes)
    - `notify_estimate_approved` - now creates per-user notifications (alert key: payments)

  4. Security Changes
    - Drop old account-scoped RLS policies (SELECT, UPDATE, DELETE)
    - Add new user-scoped RLS policies so each user only sees their own notifications

  5. Indexes
    - `idx_notifications_user_id` on user_id
    - `idx_notifications_user_created` on (user_id, created_at DESC)

  6. Notes
    - Previously, one notification was created per account and all members saw it
    - Now, notifications are created per-user, respecting each user's alert preferences
    - Users who have disabled an alert type in their settings will not receive those notifications
    - Existing notifications are assigned to the account owner for backwards compatibility
*/

-- 1. Add user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- 2. Backfill existing notifications to account owner
UPDATE notifications n
SET user_id = (
  SELECT am.user_id
  FROM account_members am
  WHERE am.account_id = n.account_id
  AND am.is_active = true
  AND am.role = 'owner'
  LIMIT 1
)
WHERE n.user_id IS NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 4. Drop old account-scoped RLS policies
DROP POLICY IF EXISTS "Account members can view notifications" ON notifications;
DROP POLICY IF EXISTS "Account members can update notifications" ON notifications;
DROP POLICY IF EXISTS "Account members can delete notifications" ON notifications;

-- 5. New user-scoped RLS policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 6. Helper function: create per-user notifications based on preferences
CREATE OR REPLACE FUNCTION create_user_notifications(
  p_account_id uuid,
  p_title text,
  p_body text,
  p_event_type text,
  p_alert_key text,
  p_reference_id uuid,
  p_reference_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member RECORD;
  _prefs jsonb;
  _alert_enabled boolean;
BEGIN
  FOR _member IN
    SELECT am.user_id, p.notification_preferences
    FROM account_members am
    LEFT JOIN profiles p ON p.user_id = am.user_id
    WHERE am.account_id = p_account_id
    AND am.is_active = true
  LOOP
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

-- 7. Update trigger functions to use per-user notifications

CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_user_notifications(
    NEW.account_id,
    'New Lead',
    'New lead from ' || COALESCE(NEW.name, 'Unknown') || COALESCE(' - ' || NEW.service_type, ''),
    'new_lead',
    'new_leads',
    NEW.id,
    'lead'
  );
  RETURN NEW;
END;
$$;

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
    'lead'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_name text;
BEGIN
  SELECT name INTO _customer_name FROM customers WHERE id = NEW.customer_id;

  PERFORM create_user_notifications(
    NEW.account_id,
    'Payment Received',
    '$' || COALESCE(NEW.amount::text, '0') || ' from ' || COALESCE(_customer_name, 'customer'),
    'payment_received',
    'payments',
    NEW.id,
    'payment'
  );
  RETURN NEW;
END;
$$;

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
    'job_schedule'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_estimate_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_name text;
BEGIN
  IF NEW.status::text != 'accepted' OR OLD.status::text = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _customer_name FROM customers c WHERE c.id = NEW.customer_id;

  PERFORM create_user_notifications(
    NEW.account_id,
    'Estimate Approved',
    COALESCE(_customer_name, 'Customer') || ' approved estimate for $' || COALESCE(NEW.total::text, '0'),
    'estimate_approved',
    'payments',
    NEW.id,
    'estimate'
  );
  RETURN NEW;
END;
$$;
