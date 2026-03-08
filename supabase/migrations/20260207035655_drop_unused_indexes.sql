/*
  # Drop unused indexes

  1. Removed Indexes
    - 34 indexes that have never been used, across multiple tables
    - These indexes consume storage and slow down writes without benefiting reads

  2. Affected Tables
    - account_members, api_keys, customers, estimate_change_orders,
      estimate_line_items, estimates, interactions, invoice_line_items,
      job_assignments, job_schedules, lead_qualifications, leads,
      material_items, payments, pricing_rules, quick_estimates,
      stripe_connect_accounts, supply_order_items, supply_orders,
      webhook_events, days_off, sms_notification_log, notifications

  3. Notes
    - These indexes were identified as never used by the database engine
    - They can be recreated later if query patterns change
*/

DROP INDEX IF EXISTS idx_account_members_invited_by;
DROP INDEX IF EXISTS idx_api_keys_account_id;
DROP INDEX IF EXISTS idx_customers_account_id;
DROP INDEX IF EXISTS idx_customers_lead_id;
DROP INDEX IF EXISTS idx_estimate_change_orders_account_id;
DROP INDEX IF EXISTS idx_estimate_line_items_account_id;
DROP INDEX IF EXISTS idx_estimates_created_by;
DROP INDEX IF EXISTS idx_interactions_account_id;
DROP INDEX IF EXISTS idx_invoice_line_items_account_id;
DROP INDEX IF EXISTS idx_invoice_line_items_invoice_id;
DROP INDEX IF EXISTS idx_job_assignments_account_id;
DROP INDEX IF EXISTS idx_lead_qualifications_account_id;
DROP INDEX IF EXISTS idx_leads_customer_id;
DROP INDEX IF EXISTS idx_material_items_account_id;
DROP INDEX IF EXISTS idx_material_items_material_list_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_pricing_rules_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_material_item_id;
DROP INDEX IF EXISTS idx_quick_estimates_account_id;
DROP INDEX IF EXISTS idx_stripe_connect_accounts_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_supply_order_id;
DROP INDEX IF EXISTS idx_supply_orders_material_list_id;
DROP INDEX IF EXISTS idx_webhook_events_invoice_id;
DROP INDEX IF EXISTS idx_webhook_events_payment_id;
DROP INDEX IF EXISTS idx_days_off_created_by;
DROP INDEX IF EXISTS idx_estimate_change_orders_changed_by;
DROP INDEX IF EXISTS idx_estimate_line_items_original_line_item_id;
DROP INDEX IF EXISTS idx_job_assignments_assigned_by;
DROP INDEX IF EXISTS idx_job_schedules_created_by;
DROP INDEX IF EXISTS idx_estimates_approval_token;
DROP INDEX IF EXISTS idx_sms_notification_log_created_at;
DROP INDEX IF EXISTS idx_notifications_account_id;
DROP INDEX IF EXISTS idx_notifications_created_at;
