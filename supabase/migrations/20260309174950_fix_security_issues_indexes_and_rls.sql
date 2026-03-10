/*
  # Fix Security Issues - Indexes and RLS Performance

  1. Add Missing Foreign Key Indexes
    - Add indexes for all unindexed foreign keys to improve query performance
    - Covers tables: account_members, api_keys, customers, days_off, email_digest_log,
      estimate_change_orders, estimate_line_items, estimates, interactions,
      invoice_line_items, job_assignments, job_schedules, lead_photos,
      lead_qualifications, leads, material_items, payments, pricing_rules,
      quick_estimates, recurring_jobs, stripe_connect_accounts, supply_order_items,
      supply_orders, webhook_events

  2. Fix RLS Policies for Performance
    - Update policies to use `(select auth.uid())` instead of `auth.uid()`
    - Prevents re-evaluation of auth functions for each row
    - Affects: account_members, job_time_entries

  3. Drop Unused Indexes
    - Remove indexes that are not being used
    - Reduces storage overhead and maintenance cost

  4. Fix Function Security
    - Set immutable search_path for update_updated_at_column function
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON account_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON customers(lead_id);
CREATE INDEX IF NOT EXISTS idx_days_off_created_by ON days_off(created_by);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_account_id ON email_digest_log(account_id);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_user_id ON email_digest_log(user_id);
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
CREATE INDEX IF NOT EXISTS idx_lead_photos_account_id ON lead_photos(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_photos_uploaded_by ON lead_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON lead_qualifications(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_material_items_account_id ON material_items(account_id);
CREATE INDEX IF NOT EXISTS idx_material_items_material_list_id ON material_items(material_list_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_account_id ON pricing_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_quick_estimates_account_id ON quick_estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_created_by ON recurring_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_customer_id ON recurring_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_account_id ON stripe_connect_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_account_id ON supply_order_items(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_material_item_id ON supply_order_items(material_item_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_supply_order_id ON supply_order_items(supply_order_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_material_list_id ON supply_orders(material_list_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice_id ON webhook_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON webhook_events(payment_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_estimates_recurring_job_id;
DROP INDEX IF EXISTS idx_job_checklist_items_account_id;
DROP INDEX IF EXISTS idx_sms_notification_log_user_id;
DROP INDEX IF EXISTS idx_customers_client_portal_token;

-- Fix RLS policies for account_members
DROP POLICY IF EXISTS "Users can view own or account memberships" ON account_members;
CREATE POLICY "Users can view own or account memberships"
  ON account_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  );

-- Fix RLS policies for job_time_entries
DROP POLICY IF EXISTS "Users can view own time entries" ON job_time_entries;
CREATE POLICY "Users can view own time entries"
  ON job_time_entries
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own time entries" ON job_time_entries;
CREATE POLICY "Users can create own time entries"
  ON job_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own time entries" ON job_time_entries;
CREATE POLICY "Users can update own time entries"
  ON job_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own time entries" ON job_time_entries;
CREATE POLICY "Users can delete own time entries"
  ON job_time_entries
  FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND account_id IN (
      SELECT account_id FROM account_members WHERE user_id = (select auth.uid())
    )
  );

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
