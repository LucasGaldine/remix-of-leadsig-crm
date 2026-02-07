/*
  # Fix Security Issues: Drop Unused Indexes and Fix Security Definer View

  1. Dropped Indexes
    - Removes 39 unused indexes across multiple tables to reduce storage overhead and improve write performance
    - Tables affected: email_digest_log, lead_photos, sms_notification_log, notifications, account_members, 
      api_keys, customers, days_off, estimate_change_orders, estimate_line_items, stripe_connect_accounts,
      supply_order_items, estimates, interactions, invoice_line_items, job_assignments, job_schedules,
      lead_qualifications, leads, material_items, payments, pricing_rules, quick_estimates, supply_orders,
      webhook_events

  2. Security Definer View Fix
    - Recreates `account_members_with_profiles` view with `security_invoker = true`
    - This ensures the view executes with the privileges of the calling user, not the view creator
    - Improves security by preventing privilege escalation through the view
    - Uses correct join on `profiles.user_id` column

  3. Important Notes
    - **Leaked Password Protection**: This must be enabled manually in the Supabase Dashboard
      - Navigate to: Authentication > Providers > Email > Advanced Settings
      - Enable "Leaked Password Protection" to check passwords against HaveIBeenPwned.org
      - This cannot be configured via SQL migration
*/

-- ============================================================================
-- 1. Drop Unused Indexes
-- ============================================================================

-- Email Digest Log indexes
DROP INDEX IF EXISTS idx_email_digest_log_account_id;
DROP INDEX IF EXISTS idx_email_digest_log_user_id;
DROP INDEX IF EXISTS idx_email_digest_log_created_at;

-- Lead Photos indexes
DROP INDEX IF EXISTS idx_lead_photos_account_id;
DROP INDEX IF EXISTS idx_lead_photos_uploaded_by;

-- SMS Notification Log indexes
DROP INDEX IF EXISTS idx_sms_notification_log_user_id;

-- Notifications indexes
DROP INDEX IF EXISTS idx_notifications_user_id;

-- Account Members indexes
DROP INDEX IF EXISTS idx_account_members_invited_by;

-- API Keys indexes
DROP INDEX IF EXISTS idx_api_keys_account_id;

-- Customers indexes
DROP INDEX IF EXISTS idx_customers_account_id;
DROP INDEX IF EXISTS idx_customers_lead_id;

-- Days Off indexes
DROP INDEX IF EXISTS idx_days_off_created_by;

-- Estimate Change Orders indexes
DROP INDEX IF EXISTS idx_estimate_change_orders_account_id;
DROP INDEX IF EXISTS idx_estimate_change_orders_changed_by;

-- Estimate Line Items indexes
DROP INDEX IF EXISTS idx_estimate_line_items_account_id;
DROP INDEX IF EXISTS idx_estimate_line_items_original_line_item_id;

-- Estimates indexes
DROP INDEX IF EXISTS idx_estimates_created_by;

-- Interactions indexes
DROP INDEX IF EXISTS idx_interactions_account_id;

-- Invoice Line Items indexes
DROP INDEX IF EXISTS idx_invoice_line_items_account_id;
DROP INDEX IF EXISTS idx_invoice_line_items_invoice_id;

-- Job Assignments indexes
DROP INDEX IF EXISTS idx_job_assignments_account_id;
DROP INDEX IF EXISTS idx_job_assignments_assigned_by;

-- Job Schedules indexes
DROP INDEX IF EXISTS idx_job_schedules_created_by;

-- Lead Qualifications indexes
DROP INDEX IF EXISTS idx_lead_qualifications_account_id;

-- Leads indexes
DROP INDEX IF EXISTS idx_leads_customer_id;
DROP INDEX IF EXISTS idx_leads_client_share_token;

-- Material Items indexes
DROP INDEX IF EXISTS idx_material_items_account_id;
DROP INDEX IF EXISTS idx_material_items_material_list_id;

-- Payments indexes
DROP INDEX IF EXISTS idx_payments_invoice_id;

-- Pricing Rules indexes
DROP INDEX IF EXISTS idx_pricing_rules_account_id;

-- Quick Estimates indexes
DROP INDEX IF EXISTS idx_quick_estimates_account_id;

-- Stripe Connect Accounts indexes
DROP INDEX IF EXISTS idx_stripe_connect_accounts_account_id;

-- Supply Order Items indexes
DROP INDEX IF EXISTS idx_supply_order_items_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_material_item_id;
DROP INDEX IF EXISTS idx_supply_order_items_supply_order_id;

-- Supply Orders indexes
DROP INDEX IF EXISTS idx_supply_orders_material_list_id;

-- Webhook Events indexes
DROP INDEX IF EXISTS idx_webhook_events_invoice_id;
DROP INDEX IF EXISTS idx_webhook_events_payment_id;

-- ============================================================================
-- 2. Fix Security Definer View
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
  am.is_active,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url
FROM account_members am
LEFT JOIN profiles p ON am.user_id = p.user_id;