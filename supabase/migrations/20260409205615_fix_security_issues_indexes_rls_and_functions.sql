/*
  # Fix Security Issues: Indexes, RLS Performance, and Function Search Paths

  1. Missing Foreign Key Indexes
    - Add index on `estimates.recurring_job_id`
    - Add index on `job_checklist_items.account_id`
    - Add index on `sms_notification_log.user_id`

  2. RLS Policy Performance
    - Replace `auth.uid()` with `(select auth.uid())` in policies on:
      - `estimate_line_items_original` (2 policies)
      - `job_line_items` (4 policies)
      - `financial_exports` (3 policies)
      - `mock_crew_profiles` (4 policies)
      - `job_assignments` (1 policy: insert)
      - `estimate_versions` (4 policies)
      - `account_members` (3 policies: insert, update, delete)

  3. Function Search Path Fixes
    - Set `search_path = ''` on 6 functions with mutable search paths

  4. Drop Unused Indexes
    - Remove 35 indexes that have never been used
*/

-- ============================================================
-- 1. Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_estimates_recurring_job_id
  ON public.estimates (recurring_job_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_account_id
  ON public.job_checklist_items (account_id);

CREATE INDEX IF NOT EXISTS idx_sms_notification_log_user_id_v2
  ON public.sms_notification_log (user_id);

-- ============================================================
-- 2. Fix RLS policies to use (select auth.uid())
-- ============================================================

-- estimate_line_items_original
DROP POLICY IF EXISTS "Users can view original line items for their account" ON public.estimate_line_items_original;
CREATE POLICY "Users can view original line items for their account"
  ON public.estimate_line_items_original FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account_members
    WHERE account_members.account_id = estimate_line_items_original.account_id
    AND account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

DROP POLICY IF EXISTS "Users can insert original line items for their account" ON public.estimate_line_items_original;
CREATE POLICY "Users can insert original line items for their account"
  ON public.estimate_line_items_original FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM account_members
    WHERE account_members.account_id = estimate_line_items_original.account_id
    AND account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

-- job_line_items
DROP POLICY IF EXISTS "Users can view job line items in their account" ON public.job_line_items;
CREATE POLICY "Users can view job line items in their account"
  ON public.job_line_items FOR SELECT TO authenticated
  USING (account_id IN (
    SELECT account_members.account_id FROM account_members
    WHERE account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

DROP POLICY IF EXISTS "Users can insert job line items in their account" ON public.job_line_items;
CREATE POLICY "Users can insert job line items in their account"
  ON public.job_line_items FOR INSERT TO authenticated
  WITH CHECK (account_id IN (
    SELECT account_members.account_id FROM account_members
    WHERE account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

DROP POLICY IF EXISTS "Users can update job line items in their account" ON public.job_line_items;
CREATE POLICY "Users can update job line items in their account"
  ON public.job_line_items FOR UPDATE TO authenticated
  USING (account_id IN (
    SELECT account_members.account_id FROM account_members
    WHERE account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ))
  WITH CHECK (account_id IN (
    SELECT account_members.account_id FROM account_members
    WHERE account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

DROP POLICY IF EXISTS "Users can delete job line items in their account" ON public.job_line_items;
CREATE POLICY "Users can delete job line items in their account"
  ON public.job_line_items FOR DELETE TO authenticated
  USING (account_id IN (
    SELECT account_members.account_id FROM account_members
    WHERE account_members.user_id = (select auth.uid())
    AND account_members.is_active = true
  ));

-- financial_exports
DROP POLICY IF EXISTS "Account members can view financial exports" ON public.financial_exports;
CREATE POLICY "Account members can view financial exports"
  ON public.financial_exports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account_members
    WHERE account_members.account_id = financial_exports.account_id
    AND account_members.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Account members can create financial exports" ON public.financial_exports;
CREATE POLICY "Account members can create financial exports"
  ON public.financial_exports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = financial_exports.account_id
      AND account_members.user_id = (select auth.uid())
    )
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Export creators can delete their own exports" ON public.financial_exports;
CREATE POLICY "Export creators can delete their own exports"
  ON public.financial_exports FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- mock_crew_profiles
DROP POLICY IF EXISTS "Account members can view mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Account members can view mock crew profiles"
  ON public.mock_crew_profiles FOR SELECT TO authenticated
  USING (account_id IN (
    SELECT am.account_id FROM account_members am
    WHERE am.user_id = (select auth.uid())
    AND am.is_active = true
  ));

DROP POLICY IF EXISTS "Managers can create mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can create mock crew profiles"
  ON public.mock_crew_profiles FOR INSERT TO authenticated
  WITH CHECK (is_user_account_manager(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Managers can update mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can update mock crew profiles"
  ON public.mock_crew_profiles FOR UPDATE TO authenticated
  USING (is_user_account_manager(account_id, (select auth.uid())))
  WITH CHECK (is_user_account_manager(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Managers can delete mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can delete mock crew profiles"
  ON public.mock_crew_profiles FOR DELETE TO authenticated
  USING (is_user_account_manager(account_id, (select auth.uid())));

-- job_assignments (insert policy)
DROP POLICY IF EXISTS "Managers can create job assignments" ON public.job_assignments;
CREATE POLICY "Managers can create job assignments"
  ON public.job_assignments FOR INSERT TO authenticated
  WITH CHECK (
    is_user_account_manager(account_id, (select auth.uid()))
    AND ((lead_id IS NULL) OR is_lead_in_account(lead_id, account_id))
    AND ((job_schedule_id IS NULL) OR is_schedule_in_account(job_schedule_id, account_id))
    AND (
      (
        (user_id IS NOT NULL) AND (mock_crew_profile_id IS NULL)
        AND is_user_in_account(user_id, account_id)
        AND ((job_schedule_id IS NULL) OR (NOT check_assignment_overlap(user_id, job_schedule_id, account_id)))
      )
      OR (
        (user_id IS NULL) AND (mock_crew_profile_id IS NOT NULL)
        AND is_mock_profile_in_account(mock_crew_profile_id, account_id)
        AND ((job_schedule_id IS NULL) OR (NOT check_mock_assignment_overlap(mock_crew_profile_id, job_schedule_id, account_id)))
      )
    )
  );

-- estimate_versions
DROP POLICY IF EXISTS "Account members can view estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can view estimate versions"
  ON public.estimate_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = estimate_versions.account_id
    AND am.user_id = (select auth.uid())
    AND am.is_active = true
  ));

DROP POLICY IF EXISTS "Account members can insert estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can insert estimate versions"
  ON public.estimate_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = estimate_versions.account_id
    AND am.user_id = (select auth.uid())
    AND am.is_active = true
  ));

DROP POLICY IF EXISTS "Account members can update estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can update estimate versions"
  ON public.estimate_versions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = estimate_versions.account_id
    AND am.user_id = (select auth.uid())
    AND am.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = estimate_versions.account_id
    AND am.user_id = (select auth.uid())
    AND am.is_active = true
  ));

DROP POLICY IF EXISTS "Account members can delete estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can delete estimate versions"
  ON public.estimate_versions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = estimate_versions.account_id
    AND am.user_id = (select auth.uid())
    AND am.is_active = true
  ));

-- account_members (insert, update, delete)
DROP POLICY IF EXISTS "Managers can invite members" ON public.account_members;
CREATE POLICY "Managers can invite members"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Managers can update members" ON public.account_members;
CREATE POLICY "Managers can update members"
  ON public.account_members FOR UPDATE TO authenticated
  USING (is_account_admin(account_id, (select auth.uid())))
  WITH CHECK (is_account_admin(account_id, (select auth.uid())));

DROP POLICY IF EXISTS "Managers can remove members" ON public.account_members;
CREATE POLICY "Managers can remove members"
  ON public.account_members FOR DELETE TO authenticated
  USING (is_account_admin(account_id, (select auth.uid())));

-- ============================================================
-- 3. Fix function search paths
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_user_account_manager(p_account_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.account_members
  WHERE account_id = p_account_id
  AND user_id = p_user_id
  AND is_active = true
  AND role IN ('owner', 'admin', 'crew_lead', 'sales')
);
$$;

CREATE OR REPLACE FUNCTION public.set_estimate_versions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_mentioned_users(note_text text)
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  user_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT m[2]::uuid)
  INTO user_ids
  FROM regexp_matches(note_text, '@\[([^\]]+)\]\(([a-f0-9-]+)\)', 'g') AS m
  WHERE m[2] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$';

  RETURN COALESCE(user_ids, ARRAY[]::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_mock_profile_in_account(p_mock_profile_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mock_crew_profiles mcp
    WHERE mcp.id = p_mock_profile_id
    AND mcp.account_id = p_account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_assignment_overlap(p_user_id uuid, p_schedule_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.user_id = p_user_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_mock_assignment_overlap(p_mock_profile_id uuid, p_schedule_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_mock_profile_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.mock_crew_profile_id = p_mock_profile_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$$;

-- ============================================================
-- 4. Drop unused indexes
-- ============================================================

DROP INDEX IF EXISTS idx_recurring_jobs_customer_id;
DROP INDEX IF EXISTS idx_stripe_connect_accounts_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_account_id;
DROP INDEX IF EXISTS idx_supply_order_items_material_item_id;
DROP INDEX IF EXISTS idx_supply_order_items_supply_order_id;
DROP INDEX IF EXISTS idx_supply_orders_material_list_id;
DROP INDEX IF EXISTS idx_webhook_events_invoice_id;
DROP INDEX IF EXISTS idx_webhook_events_payment_id;
DROP INDEX IF EXISTS idx_leads_new_status;
DROP INDEX IF EXISTS idx_estimate_line_items_original_account_id;
DROP INDEX IF EXISTS idx_estimate_versions_account_id;
DROP INDEX IF EXISTS idx_mock_crew_profiles_account_id;
DROP INDEX IF EXISTS idx_account_members_invited_by;
DROP INDEX IF EXISTS idx_api_keys_account_id;
DROP INDEX IF EXISTS idx_customers_account_id;
DROP INDEX IF EXISTS idx_customers_lead_id;
DROP INDEX IF EXISTS idx_days_off_created_by;
DROP INDEX IF EXISTS idx_email_digest_log_account_id;
DROP INDEX IF EXISTS idx_email_digest_log_user_id;
DROP INDEX IF EXISTS idx_estimate_change_orders_account_id;
DROP INDEX IF EXISTS idx_estimate_change_orders_changed_by;
DROP INDEX IF EXISTS idx_estimate_line_items_account_id;
DROP INDEX IF EXISTS idx_job_assignments_assigned_by;
DROP INDEX IF EXISTS idx_interactions_account_id;
DROP INDEX IF EXISTS idx_invoice_line_items_account_id;
DROP INDEX IF EXISTS idx_invoice_line_items_invoice_id;
DROP INDEX IF EXISTS idx_job_schedules_created_by;
DROP INDEX IF EXISTS idx_lead_photos_account_id;
DROP INDEX IF EXISTS idx_lead_photos_uploaded_by;
DROP INDEX IF EXISTS idx_lead_qualifications_account_id;
DROP INDEX IF EXISTS idx_material_items_account_id;
DROP INDEX IF EXISTS idx_material_items_material_list_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_quick_estimates_account_id;
DROP INDEX IF EXISTS idx_recurring_jobs_created_by;
