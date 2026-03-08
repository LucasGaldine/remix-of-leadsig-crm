/*
  # Create notifications table and auto-insert triggers

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `account_id` (uuid, FK to accounts) - the account this notification belongs to
      - `title` (text) - short notification title
      - `body` (text) - notification description/detail
      - `event_type` (text) - category: new_lead, lead_status_change, payment_received, schedule_change, estimate_approved
      - `reference_id` (uuid, nullable) - ID of the related record (lead, payment, etc.)
      - `reference_type` (text, nullable) - the type of related record (lead, payment, estimate, job_schedule)
      - `is_read` (boolean) - whether the notification has been read
      - `created_at` (timestamptz)

  2. Triggers
    - On leads INSERT: creates "New lead" notification
    - On leads UPDATE (status change): creates "Lead status changed" notification
    - On payments INSERT: creates "Payment received" notification
    - On job_schedules INSERT: creates "Job scheduled" notification
    - On estimates UPDATE (status to accepted): creates "Estimate approved" notification

  3. Security
    - Enable RLS on notifications
    - Account members can view their account's notifications
    - Account members can update (mark as read) their account's notifications
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = notifications.account_id
      AND account_members.user_id = (SELECT auth.uid())
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Account members can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = notifications.account_id
      AND account_members.user_id = (SELECT auth.uid())
      AND account_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = notifications.account_id
      AND account_members.user_id = (SELECT auth.uid())
      AND account_members.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_notifications_account_id ON notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(account_id, is_read);

-- Trigger: new lead notification
CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (account_id, title, body, event_type, reference_id, reference_type)
  VALUES (
    NEW.account_id,
    'New Lead',
    'New lead from ' || COALESCE(NEW.name, 'Unknown') || COALESCE(' - ' || NEW.service_type, ''),
    'new_lead',
    NEW.id,
    'lead'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_lead ON leads;
CREATE TRIGGER trigger_notify_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_lead();

-- Trigger: lead status change notification
CREATE OR REPLACE FUNCTION notify_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (account_id, title, body, event_type, reference_id, reference_type)
  VALUES (
    NEW.account_id,
    'Lead Status Updated',
    COALESCE(NEW.name, 'Lead') || ' moved to ' || NEW.status::text,
    'lead_status_change',
    NEW.id,
    'lead'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_lead_status_change ON leads;
CREATE TRIGGER trigger_notify_lead_status_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_status_change();

-- Trigger: payment received notification
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _customer_name text;
BEGIN
  SELECT name INTO _customer_name FROM customers WHERE id = NEW.customer_id;

  INSERT INTO notifications (account_id, title, body, event_type, reference_id, reference_type)
  VALUES (
    NEW.account_id,
    'Payment Received',
    '$' || COALESCE(NEW.amount::text, '0') || ' from ' || COALESCE(_customer_name, 'customer'),
    'payment_received',
    NEW.id,
    'payment'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_payment_received ON payments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_received();

-- Trigger: job scheduled notification
CREATE OR REPLACE FUNCTION notify_job_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _lead_name text;
BEGIN
  SELECT name INTO _lead_name FROM leads WHERE id = NEW.lead_id;

  INSERT INTO notifications (account_id, title, body, event_type, reference_id, reference_type)
  VALUES (
    NEW.account_id,
    'Job Scheduled',
    COALESCE(_lead_name, 'Job') || ' scheduled for ' || NEW.scheduled_date::text,
    'schedule_change',
    NEW.lead_id,
    'job_schedule'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_job_scheduled ON job_schedules;
CREATE TRIGGER trigger_notify_job_scheduled
  AFTER INSERT ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_scheduled();

-- Trigger: estimate approved notification
CREATE OR REPLACE FUNCTION notify_estimate_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _customer_name text;
BEGIN
  IF NEW.status::text != 'accepted' OR OLD.status::text = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _customer_name FROM customers c WHERE c.id = NEW.customer_id;

  INSERT INTO notifications (account_id, title, body, event_type, reference_id, reference_type)
  VALUES (
    NEW.account_id,
    'Estimate Approved',
    COALESCE(_customer_name, 'Customer') || ' approved estimate for $' || COALESCE(NEW.total::text, '0'),
    'estimate_approved',
    NEW.id,
    'estimate'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_estimate_approved ON estimates;
CREATE TRIGGER trigger_notify_estimate_approved
  AFTER UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION notify_estimate_approved();
