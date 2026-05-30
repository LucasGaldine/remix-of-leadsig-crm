/*
  # Fix security and performance issues

  1. New Indexes (40 unindexed foreign keys)
    - `account_members.invited_by`
    - `api_keys.account_id`
    - `customers.account_id`, `customers.lead_id`
    - `days_off.created_by`
    - `email_digest_log.account_id`, `email_digest_log.user_id`
    - `estimate_change_orders.account_id`, `estimate_change_orders.changed_by`
    - `estimate_email_notifications_log.account_id`
    - `estimate_line_items.account_id`
    - `estimate_line_items_original.account_id`
    - `estimate_versions.account_id`
    - `interactions.account_id`
    - `invoice_line_items.account_id`, `invoice_line_items.invoice_id`
    - `job_assignments.assigned_by`
    - `job_schedules.created_by`
    - `lead_photos.account_id`, `lead_photos.uploaded_by`, `lead_photos.uploaded_by` (profiles fkey)
    - `lead_qualifications.account_id`
    - `line_item_templates.created_by`
    - `material_items.account_id`, `material_items.material_list_id`
    - `message_automation_delivery_log.account_id`, `message_automation_delivery_log.lead_id`
    - `message_automation_events.job_schedule_id`, `message_automation_events.lead_id`
    - `payments.invoice_id`
    - `quick_estimates.account_id`
    - `recurring_jobs.created_by`, `recurring_jobs.customer_id`
    - `stripe_connect_accounts.account_id`
    - `supply_order_items.account_id`, `supply_order_items.material_item_id`, `supply_order_items.supply_order_id`
    - `supply_orders.material_list_id`
    - `webhook_events.invoice_id`, `webhook_events.payment_id`

  2. RLS Policy Fixes (7 policies across 4 tables)
    - Replace `auth.uid()` with `(select auth.uid())` for single-evaluation per query
    - Tables: line_item_templates, message_automation_events, message_automation_delivery_log, estimate_email_notifications_log

  3. Dropped Unused Indexes (5)
    - `idx_message_automation_events_account`
    - `idx_message_automation_delivery_log_event`
    - `idx_estimates_recurring_job_id`
    - `idx_job_checklist_items_account_id`
    - `idx_sms_notification_log_user_id_v2`

  4. Function Fixes (2 functions, 3 overloads)
    - `compute_job_message_scheduled_for` - set immutable search_path
    - `render_job_message_template` (2 overloads) - set immutable search_path
*/

-- ============================================================
-- 1. Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON public.account_members (invited_by);

CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON public.api_keys (account_id);

CREATE INDEX IF NOT EXISTS idx_customers_account_id ON public.customers (account_id);

CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON public.customers (lead_id);

CREATE INDEX IF NOT EXISTS idx_days_off_created_by ON public.days_off (created_by);

CREATE INDEX IF NOT EXISTS idx_email_digest_log_account_id ON public.email_digest_log (account_id);

CREATE INDEX IF NOT EXISTS idx_email_digest_log_user_id ON public.email_digest_log (user_id);

DO $$
BEGIN
  IF to_regclass('public.estimate_change_orders') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_account_id ON public.estimate_change_orders (account_id);
    CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_changed_by ON public.estimate_change_orders (changed_by);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimate_email_notifications_log_account_id ON public.estimate_email_notifications_log (account_id);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_account_id ON public.estimate_line_items (account_id);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_account_id ON public.estimate_line_items_original (account_id);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_account_id ON public.estimate_versions (account_id);

CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON public.interactions (account_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON public.invoice_line_items (account_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items (invoice_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON public.job_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_job_schedules_created_by ON public.job_schedules (created_by);

CREATE INDEX IF NOT EXISTS idx_lead_photos_account_id ON public.lead_photos (account_id);

CREATE INDEX IF NOT EXISTS idx_lead_photos_uploaded_by ON public.lead_photos (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON public.lead_qualifications (account_id);

CREATE INDEX IF NOT EXISTS idx_line_item_templates_created_by ON public.line_item_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_material_items_account_id ON public.material_items (account_id);

CREATE INDEX IF NOT EXISTS idx_material_items_material_list_id ON public.material_items (material_list_id);

CREATE INDEX IF NOT EXISTS idx_message_automation_delivery_log_account_id ON public.message_automation_delivery_log (account_id);

CREATE INDEX IF NOT EXISTS idx_message_automation_delivery_log_lead_id ON public.message_automation_delivery_log (lead_id);

CREATE INDEX IF NOT EXISTS idx_message_automation_events_job_schedule_id ON public.message_automation_events (job_schedule_id);

CREATE INDEX IF NOT EXISTS idx_message_automation_events_lead_id ON public.message_automation_events (lead_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_quick_estimates_account_id ON public.quick_estimates (account_id);

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_created_by ON public.recurring_jobs (created_by);

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_customer_id ON public.recurring_jobs (customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_account_id ON public.stripe_connect_accounts (account_id);

CREATE INDEX IF NOT EXISTS idx_supply_order_items_account_id ON public.supply_order_items (account_id);

CREATE INDEX IF NOT EXISTS idx_supply_order_items_material_item_id ON public.supply_order_items (material_item_id);

CREATE INDEX IF NOT EXISTS idx_supply_order_items_supply_order_id ON public.supply_order_items (supply_order_id);

CREATE INDEX IF NOT EXISTS idx_supply_orders_material_list_id ON public.supply_orders (material_list_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice_id ON public.webhook_events (invoice_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON public.webhook_events (payment_id);


-- ============================================================
-- 2. Fix RLS policies to use (select auth.uid())
-- ============================================================

-- line_item_templates: 4 policies
DROP POLICY IF EXISTS "Users can view line item templates in their account" ON public.line_item_templates;

CREATE POLICY "Users can view line item templates in their account"
  ON public.line_item_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = line_item_templates.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
  ));


DROP POLICY IF EXISTS "Users can insert line item templates in their account" ON public.line_item_templates;

CREATE POLICY "Users can insert line item templates in their account"
  ON public.line_item_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = line_item_templates.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
  ));


DROP POLICY IF EXISTS "Users can update line item templates in their account" ON public.line_item_templates;

CREATE POLICY "Users can update line item templates in their account"
  ON public.line_item_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = line_item_templates.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = line_item_templates.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
  ));


DROP POLICY IF EXISTS "Users can delete line item templates in their account" ON public.line_item_templates;

CREATE POLICY "Users can delete line item templates in their account"
  ON public.line_item_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = line_item_templates.account_id
      AND account_members.user_id = (select auth.uid())
      AND account_members.is_active = true
  ));


-- message_automation_events: 1 policy
DROP POLICY IF EXISTS "Account members can view message automation events" ON public.message_automation_events;

CREATE POLICY "Account members can view message automation events"
  ON public.message_automation_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = message_automation_events.account_id
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  ));


-- message_automation_delivery_log: 1 policy
DROP POLICY IF EXISTS "Account members can view message automation delivery logs" ON public.message_automation_delivery_log;

CREATE POLICY "Account members can view message automation delivery logs"
  ON public.message_automation_delivery_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = message_automation_delivery_log.account_id
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  ));


-- estimate_email_notifications_log: 1 policy
DROP POLICY IF EXISTS "Account members can view estimate email notifications" ON public.estimate_email_notifications_log;

CREATE POLICY "Account members can view estimate email notifications"
  ON public.estimate_email_notifications_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = estimate_email_notifications_log.account_id
      AND am.user_id = (select auth.uid())
      AND am.is_active = true
  ));


-- ============================================================
-- 3. Drop unused indexes
-- ============================================================

DROP INDEX IF EXISTS public.idx_message_automation_events_account;

DROP INDEX IF EXISTS public.idx_message_automation_delivery_log_event;

DROP INDEX IF EXISTS public.idx_estimates_recurring_job_id;

DROP INDEX IF EXISTS public.idx_job_checklist_items_account_id;

DROP INDEX IF EXISTS public.idx_sms_notification_log_user_id_v2;


-- ============================================================
-- 4. Fix functions with mutable search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_job_message_scheduled_for(trigger_type text, offset_minutes integer, base_ts timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  now_ts timestamptz := now();

  effective_base timestamptz := COALESCE(base_ts, now());

  scheduled_ts timestamptz;

BEGIN
  IF trigger_type = 'before_schedule_start' THEN
    scheduled_ts := effective_base - make_interval(mins => GREATEST(offset_minutes, 0));

  ELSIF trigger_type = 'after_schedule_start' THEN
    scheduled_ts := effective_base + make_interval(mins => GREATEST(offset_minutes, 0));

  ELSE
    scheduled_ts := now_ts;

  END IF;


  IF scheduled_ts < now_ts THEN
    RETURN now_ts;

  END IF;


  RETURN scheduled_ts;

END;

$function$;


CREATE OR REPLACE FUNCTION public.render_job_message_template(template_text text, lead_name text, service_type text, lead_status text, lead_id uuid, scheduled_date_text text, scheduled_time_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT trim(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(COALESCE(template_text, ''), '{{job_name}}', COALESCE(lead_name, '')),
                    '{{client_name}}',
                    COALESCE(lead_name, '')
                  ),
                  '{{first_name}}',
                  NULLIF(split_part(COALESCE(lead_name, ''), ' ', 1), '')
                ),
                '{{service_type}}',
                COALESCE(service_type, '')
              ),
              '{{job_status}}',
              COALESCE(lead_status, '')
            ),
            '{{lead_id}}',
            COALESCE(lead_id::text, '')
          ),
          '{{scheduled_date}}',
          COALESCE(scheduled_date_text, '')
        ),
        '{{scheduled_time}}',
        COALESCE(scheduled_time_text, '')
      ),
      '{{scheduled_datetime}}',
      trim(concat_ws(' ', COALESCE(scheduled_date_text, ''), COALESCE(scheduled_time_text, '')))
    )
  );

$function$;


CREATE OR REPLACE FUNCTION public.render_job_message_template(template_text text, lead_name text, service_type text, lead_status public.unified_status, lead_id uuid, scheduled_date_text text, scheduled_time_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT public.render_job_message_template(
    template_text,
    lead_name,
    service_type,
    lead_status::text,
    lead_id,
    scheduled_date_text,
    scheduled_time_text
  );

$function$;

;
