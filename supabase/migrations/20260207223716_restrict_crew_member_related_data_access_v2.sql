/*
  # Restrict Crew Member Access to Related Job Data

  1. Problem
    - Current policies allow all account members to view customers, estimates, lead_photos, and interactions
    - Crew members should only see data related to jobs they are assigned to

  2. Solution
    - Update SELECT policies for customers, estimates, lead_photos, and interactions
    - Only allow crew members to see data for jobs they're assigned to
    - Allow other roles to see all data in their account

  3. Security
    - Crew members can only view data related to their assigned jobs
    - Maintains proper data isolation for different user roles
*/

-- Restrict customers access
DROP POLICY IF EXISTS "Account members can view customers" ON customers;

CREATE POLICY "Account members can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all customers in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see customers for their assigned jobs
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND id IN (
        SELECT DISTINCT l.customer_id
        FROM leads l
        JOIN job_assignments ja ON ja.lead_id = l.id
        WHERE ja.user_id = auth.uid()
        AND l.customer_id IS NOT NULL
      )
    )
  );

-- Restrict estimates access
DROP POLICY IF EXISTS "Account members can view estimates" ON estimates;

CREATE POLICY "Account members can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all estimates in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see estimates for their assigned jobs (job_id references leads.id)
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND job_id IN (
        SELECT ja.lead_id
        FROM job_assignments ja
        WHERE ja.user_id = auth.uid()
        AND ja.lead_id IS NOT NULL
      )
    )
  );

-- Restrict lead_photos access
DROP POLICY IF EXISTS "Account members can view lead photos" ON lead_photos;

CREATE POLICY "Account members can view lead photos"
  ON lead_photos FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all photos in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see photos for their assigned jobs
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND lead_id IN (
        SELECT ja.lead_id
        FROM job_assignments ja
        WHERE ja.user_id = auth.uid()
        AND ja.lead_id IS NOT NULL
      )
    )
  );

-- Restrict interactions access
DROP POLICY IF EXISTS "Account members can view interactions" ON interactions;

CREATE POLICY "Account members can view interactions"
  ON interactions FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all interactions in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see interactions for their assigned jobs
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND lead_id IN (
        SELECT ja.lead_id
        FROM job_assignments ja
        WHERE ja.user_id = auth.uid()
        AND ja.lead_id IS NOT NULL
      )
    )
  );