/*
  # Fix security issues: indexes, policies, and view

  1. New Indexes (missing FK coverage)
    - `estimates.recurring_job_id` - covers `estimates_recurring_job_id_fkey`
    - `job_checklist_items.account_id` - covers `job_checklist_items_account_id_fkey`
    - `sms_notification_log.user_id` - covers `sms_notification_log_user_id_fkey`

  2. Dropped Unused Indexes
    - 35 indexes across multiple tables that have never been used,
      reducing write overhead and storage waste

  3. Policy Changes
    - Consolidated two permissive SELECT policies on `account_members`
      into a single policy to avoid ambiguous multi-policy evaluation.
      Combined logic: user can view their own membership OR members
      in accounts they belong to.

  4. View Changes
    - Recreated `account_members_with_profiles` with `security_invoker = true`
      so that RLS on the underlying tables is respected when querying
      through the view, instead of bypassing RLS as the view owner.
*/

-- 1. Add missing FK indexes
CREATE INDEX IF NOT EXISTS idx_estimates_recurring_job_id
  ON public.estimates (recurring_job_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_account_id
  ON public.job_checklist_items (account_id);

CREATE INDEX IF NOT EXISTS idx_sms_notification_log_user_id
  ON public.sms_notification_log (user_id);

-- 2. Drop unused indexes
DROP INDEX IF EXISTS public.idx_stripe_connect_accounts_account_id;
DROP INDEX IF EXISTS public.idx_supply_order_items_account_id;
DROP INDEX IF EXISTS public.idx_supply_order_items_material_item_id;
DROP INDEX IF EXISTS public.idx_supply_order_items_supply_order_id;
DROP INDEX IF EXISTS public.idx_supply_orders_material_list_id;
DROP INDEX IF EXISTS public.idx_webhook_events_invoice_id;
DROP INDEX IF EXISTS public.idx_webhook_events_payment_id;
DROP INDEX IF EXISTS public.idx_estimate_change_orders_changed_by;
DROP INDEX IF EXISTS public.idx_estimate_line_items_account_id;
DROP INDEX IF EXISTS public.idx_estimate_line_items_original_line_item_id;
DROP INDEX IF EXISTS public.idx_estimates_created_by;
DROP INDEX IF EXISTS public.idx_account_members_invited_by;
DROP INDEX IF EXISTS public.idx_api_keys_account_id;
DROP INDEX IF EXISTS public.idx_customers_account_id;
DROP INDEX IF EXISTS public.idx_customers_lead_id;
DROP INDEX IF EXISTS public.idx_days_off_created_by;
DROP INDEX IF EXISTS public.idx_email_digest_log_account_id;
DROP INDEX IF EXISTS public.idx_email_digest_log_user_id;
DROP INDEX IF EXISTS public.idx_estimate_change_orders_account_id;
DROP INDEX IF EXISTS public.idx_interactions_account_id;
DROP INDEX IF EXISTS public.idx_invoice_line_items_account_id;
DROP INDEX IF EXISTS public.idx_invoice_line_items_invoice_id;
DROP INDEX IF EXISTS public.idx_job_assignments_account_id;
DROP INDEX IF EXISTS public.idx_job_assignments_assigned_by;
DROP INDEX IF EXISTS public.idx_job_schedules_created_by;
DROP INDEX IF EXISTS public.idx_lead_photos_account_id;
DROP INDEX IF EXISTS public.idx_lead_photos_uploaded_by;
DROP INDEX IF EXISTS public.idx_lead_qualifications_account_id;
DROP INDEX IF EXISTS public.idx_leads_customer_id;
DROP INDEX IF EXISTS public.idx_material_items_account_id;
DROP INDEX IF EXISTS public.idx_material_items_material_list_id;
DROP INDEX IF EXISTS public.idx_payments_invoice_id;
DROP INDEX IF EXISTS public.idx_pricing_rules_account_id;
DROP INDEX IF EXISTS public.idx_quick_estimates_account_id;
DROP INDEX IF EXISTS public.idx_recurring_jobs_created_by;
DROP INDEX IF EXISTS public.idx_recurring_jobs_customer_id;

-- 3. Consolidate multiple permissive SELECT policies on account_members
DROP POLICY IF EXISTS "Users can view members in their accounts" ON public.account_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.account_members;

CREATE POLICY "Users can view own or account memberships"
  ON public.account_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR is_account_member(account_id, auth.uid())
  );

-- 4. Recreate view with security_invoker to respect RLS
DROP VIEW IF EXISTS public.account_members_with_profiles;

CREATE VIEW public.account_members_with_profiles
  WITH (security_invoker = true)
AS
  SELECT
    am.id,
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
  FROM public.account_members am
  LEFT JOIN public.profiles p ON am.user_id = p.user_id;
