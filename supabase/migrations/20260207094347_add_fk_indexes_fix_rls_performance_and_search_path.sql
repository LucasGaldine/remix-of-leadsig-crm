/*
  # Add foreign key indexes, fix RLS performance, and fix function search path

  1. Foreign Key Indexes
    - Adds covering indexes for 32 unindexed foreign keys across all tables
    - Improves JOIN and CASCADE performance for these relationships

  2. RLS Policy Performance
    - Replaces `auth.uid()` with `(select auth.uid())` in policies on:
      - `email_digest_log` (1 policy)
      - `lead_photos` (3 policies)
      - `notifications` (3 policies)
    - This ensures `auth.uid()` is evaluated once per query instead of per row

  3. Function Fix
    - Sets `search_path = public` on `notify_sms_job_assignment` to prevent
      mutable search_path security issue

  4. Notes
    - All indexes use IF NOT EXISTS to be idempotent
    - RLS policies are dropped and recreated with the optimized pattern
    - No data changes are made
*/

-- ==========================================================
-- 1. Foreign Key Indexes
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON account_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON customers(lead_id);
CREATE INDEX IF NOT EXISTS idx_days_off_created_by ON days_off(created_by);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_account_id ON estimate_change_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_changed_by ON estimate_change_orders(changed_by);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_account_id ON estimate_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_line_item_id ON estimate_line_items(original_line_item_id);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON invoice_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_account_id ON job_assignments(account_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON job_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_job_schedules_created_by ON job_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_photos_uploaded_by ON lead_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON lead_qualifications(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_estimate_job_id ON leads(estimate_job_id);
CREATE INDEX IF NOT EXISTS idx_material_items_account_id ON material_items(account_id);
CREATE INDEX IF NOT EXISTS idx_material_items_material_list_id ON material_items(material_list_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_account_id ON pricing_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_quick_estimates_account_id ON quick_estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_account_id ON stripe_connect_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_account_id ON supply_order_items(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_material_item_id ON supply_order_items(material_item_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_supply_order_id ON supply_order_items(supply_order_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_material_list_id ON supply_orders(material_list_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice_id ON webhook_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON webhook_events(payment_id);

-- ==========================================================
-- 2. Fix RLS policies to use (select auth.uid()) pattern
-- ==========================================================

-- email_digest_log
DROP POLICY IF EXISTS "Account members can view digest logs" ON email_digest_log;
CREATE POLICY "Account members can view digest logs"
  ON email_digest_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = email_digest_log.account_id
      AND account_members.user_id = (select auth.uid())
    )
  );

-- lead_photos
DROP POLICY IF EXISTS "Account members can view lead photos" ON lead_photos;
CREATE POLICY "Account members can view lead photos"
  ON lead_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_photos.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can insert lead photos" ON lead_photos;
CREATE POLICY "Account members can insert lead photos"
  ON lead_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_photos.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Uploaders can delete own lead photos" ON lead_photos;
CREATE POLICY "Uploaders can delete own lead photos"
  ON lead_photos FOR DELETE
  TO authenticated
  USING (uploaded_by = (select auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ==========================================================
-- 3. Fix notify_sms_job_assignment search path
-- ==========================================================

CREATE OR REPLACE FUNCTION notify_sms_job_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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