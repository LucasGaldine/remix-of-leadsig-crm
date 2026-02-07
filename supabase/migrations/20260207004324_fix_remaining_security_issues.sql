/*
  # Fix Remaining Security and Performance Issues

  ## 1. Add Foreign Key Indexes (25)
    - Re-add indexes for foreign keys that were previously dropped as unused
    - These are needed for join performance even if not directly queried

  ## 2. Drop Unused Indexes (6)
    - Remove indexes created in previous migration that are not being used

  ## 3. Fix Duplicate Function Overloads
    - Drop old get_user_roles() (no args) that lacks search_path
    - Drop old has_role(uuid, app_role) that lacks search_path

  ## 4. Consolidate Multiple Permissive UPDATE Policies
    - Merge two UPDATE policies on lead_source_connections into one

  ## 5. Fix Security Definer View
    - Recreate account_members_with_profiles with SECURITY INVOKER
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON account_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON customers(lead_id);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_account_id ON estimate_change_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_account_id ON estimate_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON invoice_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_account_id ON job_assignments(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON lead_qualifications(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
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

-- ============================================================================
-- 2. Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_days_off_created_by;
DROP INDEX IF EXISTS idx_job_assignments_schedule;
DROP INDEX IF EXISTS idx_estimate_change_orders_changed_by;
DROP INDEX IF EXISTS idx_estimate_line_items_original_line_item_id;
DROP INDEX IF EXISTS idx_job_assignments_assigned_by;
DROP INDEX IF EXISTS idx_job_schedules_created_by;

-- ============================================================================
-- 3. Drop Old Function Overloads Without search_path
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_roles() CASCADE;
DROP FUNCTION IF EXISTS has_role(uuid, app_role) CASCADE;

-- ============================================================================
-- 4. Consolidate Multiple Permissive UPDATE Policies on lead_source_connections
-- ============================================================================

DROP POLICY IF EXISTS "Account owners and admins can update lead source connections" ON lead_source_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON lead_source_connections;

CREATE POLICY "Account owners and admins can update lead source connections"
  ON lead_source_connections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_source_connections.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = lead_source_connections.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 5. Fix Security Definer View
-- ============================================================================

DROP VIEW IF EXISTS account_members_with_profiles;
CREATE VIEW account_members_with_profiles
WITH (security_invoker = true)
AS
SELECT 
  am.account_id,
  am.user_id,
  am.role,
  am.invited_by,
  am.invited_at,
  am.joined_at,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url
FROM account_members am
LEFT JOIN profiles p ON am.user_id = p.id;