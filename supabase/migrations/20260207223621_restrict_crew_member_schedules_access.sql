/*
  # Restrict Crew Member Access to Assigned Schedules Only

  1. Problem
    - Current policy allows all account members to view all job schedules
    - Crew members should only see schedules they are specifically assigned to

  2. Solution
    - Update the job_schedules SELECT policy to check user role
    - Only allow crew members to see schedules they're assigned to via job_assignments
    - Allow other roles to see all schedules in their account

  3. Security
    - Crew members can only view schedules assigned to them through job_assignments
    - Maintains proper data isolation for different user roles
*/

DROP POLICY IF EXISTS "Account members can view their job schedules" ON job_schedules;

CREATE POLICY "Account members can view their job schedules"
  ON job_schedules FOR SELECT
  TO authenticated
  USING (
    -- Managers and sales can see all schedules in their account
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    -- Crew members can only see schedules they're assigned to
    (
      EXISTS (
        SELECT 1 FROM account_members am
        WHERE am.user_id = auth.uid()
        AND am.is_active = true
        AND am.role = 'crew_member'
      )
      AND id IN (
        SELECT ja.job_schedule_id 
        FROM job_assignments ja
        WHERE ja.user_id = auth.uid()
        AND ja.job_schedule_id IS NOT NULL
      )
    )
  );