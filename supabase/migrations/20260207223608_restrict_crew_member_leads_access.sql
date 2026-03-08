/*
  # Restrict Crew Member Access to Assigned Jobs Only

  1. Problem
    - Current policy allows all account members (including crew_member role) to view all leads
    - Crew members should only see jobs they are specifically assigned to

  2. Solution
    - Update the leads SELECT policy to check user role
    - Only allow crew members to see jobs they're assigned to via job_assignments
    - Allow other roles (owner, admin, sales, crew_lead) to see all jobs in their account

  3. Security
    - Crew members can only view jobs assigned to them through job_assignments/job_schedules
    - Maintains proper data isolation for different user roles
*/

DROP POLICY IF EXISTS "Account members can view leads" ON leads;

CREATE POLICY "Account members can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all leads in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see leads they're assigned to
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND id IN (
        SELECT DISTINCT ja.lead_id 
        FROM job_assignments ja
        WHERE ja.user_id = auth.uid()
        AND ja.lead_id IS NOT NULL
      )
    )
  );