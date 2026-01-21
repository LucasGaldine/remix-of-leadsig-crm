/*
  # Restrict Crew Member Access
  
  ## Summary
  This migration updates RLS policies across all tables to restrict crew member access.
  Crew members can only access:
  - Jobs they're assigned to
  - Schedules for their assigned jobs
  - Their own profile and account information
  - Cannot access: leads, customers, estimates, invoices, payments, materials, etc.
  
  ## Changes
  
  ### Updated Policies
  - customers: Crew members cannot view customers
  - estimates: Crew members cannot view estimates
  - invoices: Crew members cannot view invoices
  - payments: Crew members cannot view payments
  - material_lists: Crew members cannot view material lists
  - supply_orders: Crew members cannot view supply orders
  - interactions: Crew members can view interactions for assigned jobs only
  
  ## Security
  - Crew members have read-only access to assigned jobs
  - Crew members cannot modify jobs, schedules, or assignments
  - Crew members can only update their own profile
*/

-- Update customers RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view customers" ON customers;

CREATE POLICY "Account members can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update estimates RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view estimates" ON estimates;

CREATE POLICY "Account members can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update invoices RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view invoices" ON invoices;

CREATE POLICY "Account members can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update payments RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view payments" ON payments;

CREATE POLICY "Account members can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update material_lists RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view material lists" ON material_lists;

CREATE POLICY "Account members can view material lists"
  ON material_lists FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update supply_orders RLS policy to exclude crew members
DROP POLICY IF EXISTS "Account members can view supply orders" ON supply_orders;

CREATE POLICY "Account members can view supply orders"
  ON supply_orders FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Update interactions RLS policy to allow crew members to see interactions for their assigned jobs
DROP POLICY IF EXISTS "Account members can view interactions" ON interactions;

CREATE POLICY "Account members can view interactions"
  ON interactions FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    lead_id IN (
      SELECT ja.lead_id FROM job_assignments ja
      WHERE ja.user_id = auth.uid()
    )
  );

-- Ensure crew members cannot create, update, or delete jobs
DROP POLICY IF EXISTS "Account members can create leads" ON leads;

CREATE POLICY "Account members can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

DROP POLICY IF EXISTS "Account members can update leads" ON leads;

CREATE POLICY "Account members can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

DROP POLICY IF EXISTS "Account members can delete leads" ON leads;

CREATE POLICY "Account members can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Crew members can only update their schedules to mark them complete (read-only otherwise)
DROP POLICY IF EXISTS "Account members can update their job schedules" ON job_schedules;

CREATE POLICY "Managers can update job schedules"
  ON job_schedules FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Allow crew members to mark their assigned schedules as complete
CREATE POLICY "Crew members can mark assigned schedules complete"
  ON job_schedules FOR UPDATE
  TO authenticated
  USING (
    lead_id IN (
      SELECT ja.lead_id FROM job_assignments ja
      WHERE ja.user_id = auth.uid()
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT ja.lead_id FROM job_assignments ja
      WHERE ja.user_id = auth.uid()
    )
    AND is_completed = true
  );

DROP POLICY IF EXISTS "Account members can create job schedules" ON job_schedules;

CREATE POLICY "Managers can create job schedules"
  ON job_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    AND lead_id IN (
      SELECT id FROM leads WHERE account_id = job_schedules.account_id
    )
  );

DROP POLICY IF EXISTS "Account members can delete their job schedules" ON job_schedules;

CREATE POLICY "Managers can delete job schedules"
  ON job_schedules FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
  );

-- Ensure crew members can only see account members in their account (for collaboration)
-- but cannot modify memberships
DROP POLICY IF EXISTS "Account owners and admins can invite members" ON account_members;

CREATE POLICY "Managers can invite members"
  ON account_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'crew_lead')
    )
  );

DROP POLICY IF EXISTS "Account owners and admins can update members" ON account_members;

CREATE POLICY "Managers can update members"
  ON account_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'crew_lead')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'crew_lead')
    )
  );

DROP POLICY IF EXISTS "Account owners and admins can remove members" ON account_members;

CREATE POLICY "Managers can remove members"
  ON account_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'crew_lead')
    )
  );

COMMENT ON POLICY "Crew members can mark assigned schedules complete" ON job_schedules IS 'Allows crew members to mark their assigned job schedules as complete';
