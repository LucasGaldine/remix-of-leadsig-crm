/*
  # Fix FK indexes, RLS performance, and drop unused indexes

  1. Missing FK Indexes
    - Add indexes on all unindexed foreign key columns across 30+ tables
    - These indexes improve JOIN and DELETE performance on FK relationships

  2. RLS Policy Performance Fixes
    - Replace `auth.uid()` with `(select auth.uid())` in RLS policies
    - This prevents per-row re-evaluation of the auth function
    - Affected tables: account_members, leads, job_schedules, customers,
      lead_photos, interactions, job_checklist_items, recurring_jobs, estimates

  3. Unused Index Cleanup
    - Drop idx_job_checklist_items_account_id (unused)
    - Drop idx_recurring_jobs_account_id (unused)
    - Drop idx_estimates_recurring_job_id (unused)
    - Drop idx_recurring_jobs_client_share_token (unused)

  4. Notes
    - Multiple permissive SELECT policies on account_members are intentional
      (own-membership check + account-level check)
    - Security definer view account_members_with_profiles is intentional
    - Leaked password protection must be enabled in the Supabase dashboard
*/

-- ============================================================
-- 1. ADD MISSING FK INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON public.account_members (invited_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON public.api_keys (account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON public.customers (account_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON public.customers (lead_id);
CREATE INDEX IF NOT EXISTS idx_days_off_created_by ON public.days_off (created_by);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_account_id ON public.email_digest_log (account_id);
CREATE INDEX IF NOT EXISTS idx_email_digest_log_user_id ON public.email_digest_log (user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_account_id ON public.estimate_change_orders (account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_changed_by ON public.estimate_change_orders (changed_by);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_account_id ON public.estimate_line_items (account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_line_item_id ON public.estimate_line_items (original_line_item_id);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON public.estimates (created_by);
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON public.interactions (account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON public.invoice_line_items (account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_account_id ON public.job_assignments (account_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON public.job_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_job_schedules_created_by ON public.job_schedules (created_by);
CREATE INDEX IF NOT EXISTS idx_lead_photos_account_id ON public.lead_photos (account_id);
CREATE INDEX IF NOT EXISTS idx_lead_photos_uploaded_by ON public.lead_photos (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON public.lead_qualifications (account_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads (customer_id);
CREATE INDEX IF NOT EXISTS idx_material_items_account_id ON public.material_items (account_id);
CREATE INDEX IF NOT EXISTS idx_material_items_material_list_id ON public.material_items (material_list_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_account_id ON public.pricing_rules (account_id);
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
-- 2. FIX RLS POLICIES: auth.uid() -> (select auth.uid())
-- ============================================================

-- --- account_members: "Users can view members in their accounts" ---
DROP POLICY IF EXISTS "Users can view members in their accounts" ON public.account_members;
CREATE POLICY "Users can view members in their accounts"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (is_account_member(account_id, (select auth.uid())));

-- --- leads: "Account members can view leads" ---
DROP POLICY IF EXISTS "Account members can view leads" ON public.leads;
CREATE POLICY "Account members can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND id IN (
        SELECT DISTINCT ja.lead_id FROM public.job_assignments ja
        WHERE ja.user_id = (select auth.uid()) AND ja.lead_id IS NOT NULL
      )
    )
  );

-- --- job_schedules: "Account members can view their job schedules" ---
DROP POLICY IF EXISTS "Account members can view their job schedules" ON public.job_schedules;
CREATE POLICY "Account members can view their job schedules"
  ON public.job_schedules FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND id IN (
        SELECT ja.job_schedule_id FROM public.job_assignments ja
        WHERE ja.user_id = (select auth.uid()) AND ja.job_schedule_id IS NOT NULL
      )
    )
  );

-- --- customers: "Account members can view customers" ---
DROP POLICY IF EXISTS "Account members can view customers" ON public.customers;
CREATE POLICY "Account members can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND id IN (
        SELECT DISTINCT l.customer_id FROM public.leads l
        JOIN public.job_assignments ja ON ja.lead_id = l.id
        WHERE ja.user_id = (select auth.uid()) AND l.customer_id IS NOT NULL
      )
    )
  );

-- --- lead_photos: "Account members can view lead photos" ---
DROP POLICY IF EXISTS "Account members can view lead photos" ON public.lead_photos;
CREATE POLICY "Account members can view lead photos"
  ON public.lead_photos FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND lead_id IN (
        SELECT ja.lead_id FROM public.job_assignments ja
        WHERE ja.user_id = (select auth.uid()) AND ja.lead_id IS NOT NULL
      )
    )
  );

-- --- interactions: "Account members can view interactions" ---
DROP POLICY IF EXISTS "Account members can view interactions" ON public.interactions;
CREATE POLICY "Account members can view interactions"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND lead_id IN (
        SELECT ja.lead_id FROM public.job_assignments ja
        WHERE ja.user_id = (select auth.uid()) AND ja.lead_id IS NOT NULL
      )
    )
  );

-- --- estimates: "Account members can view estimates" ---
DROP POLICY IF EXISTS "Account members can view estimates" ON public.estimates;
CREATE POLICY "Account members can view estimates"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (
    (account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = (select auth.uid()) AND am.is_active = true
        AND am.role = ANY(ARRAY['owner','admin','sales','crew_lead']::app_role[])
    ))
    OR
    (
      EXISTS (
        SELECT 1 FROM public.account_members am
        WHERE am.user_id = (select auth.uid()) AND am.is_active = true AND am.role = 'crew_member'::app_role
      )
      AND (
        job_id IN (
          SELECT ja.lead_id FROM public.job_assignments ja
          WHERE ja.user_id = (select auth.uid()) AND ja.lead_id IS NOT NULL
        )
        OR recurring_job_id IN (
          SELECT l.recurring_job_id FROM public.leads l
          JOIN public.job_assignments ja ON ja.lead_id = l.id
          WHERE ja.user_id = (select auth.uid()) AND l.recurring_job_id IS NOT NULL
        )
      )
    )
  );

-- --- job_checklist_items: all 4 policies ---
DROP POLICY IF EXISTS "Account members can view checklist items" ON public.job_checklist_items;
CREATE POLICY "Account members can view checklist items"
  ON public.job_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = job_checklist_items.account_id
        AND account_members.user_id = (select auth.uid())
        AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can insert checklist items" ON public.job_checklist_items;
CREATE POLICY "Account members can insert checklist items"
  ON public.job_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = job_checklist_items.account_id
        AND account_members.user_id = (select auth.uid())
        AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can update checklist items" ON public.job_checklist_items;
CREATE POLICY "Account members can update checklist items"
  ON public.job_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = job_checklist_items.account_id
        AND account_members.user_id = (select auth.uid())
        AND account_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = job_checklist_items.account_id
        AND account_members.user_id = (select auth.uid())
        AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can delete checklist items" ON public.job_checklist_items;
CREATE POLICY "Account members can delete checklist items"
  ON public.job_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = job_checklist_items.account_id
        AND account_members.user_id = (select auth.uid())
        AND account_members.is_active = true
    )
  );

-- --- recurring_jobs: all 4 policies ---
DROP POLICY IF EXISTS "Users can view recurring jobs in their account" ON public.recurring_jobs;
CREATE POLICY "Users can view recurring jobs in their account"
  ON public.recurring_jobs FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_members.account_id FROM public.account_members
      WHERE account_members.user_id = (select auth.uid()) AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can create recurring jobs in their account" ON public.recurring_jobs;
CREATE POLICY "Users can create recurring jobs in their account"
  ON public.recurring_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_members.account_id FROM public.account_members
      WHERE account_members.user_id = (select auth.uid()) AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can update recurring jobs in their account" ON public.recurring_jobs;
CREATE POLICY "Users can update recurring jobs in their account"
  ON public.recurring_jobs FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_members.account_id FROM public.account_members
      WHERE account_members.user_id = (select auth.uid()) AND account_members.is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_members.account_id FROM public.account_members
      WHERE account_members.user_id = (select auth.uid()) AND account_members.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can delete recurring jobs in their account" ON public.recurring_jobs;
CREATE POLICY "Users can delete recurring jobs in their account"
  ON public.recurring_jobs FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_members.account_id FROM public.account_members
      WHERE account_members.user_id = (select auth.uid()) AND account_members.is_active = true
    )
  );

-- ============================================================
-- 3. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_job_checklist_items_account_id;
DROP INDEX IF EXISTS public.idx_recurring_jobs_account_id;
DROP INDEX IF EXISTS public.idx_estimates_recurring_job_id;
DROP INDEX IF EXISTS public.idx_recurring_jobs_client_share_token;
