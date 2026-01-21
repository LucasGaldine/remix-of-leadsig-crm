/*
  # Add Crew Member Role and Job Assignments
  
  ## Summary
  This migration adds support for crew members who have limited access to the system.
  Crew members can only see jobs they're assigned to, their schedule, and basic settings.
  
  ## Changes
  
  ### Enums
  - Add 'crew_member' to app_role enum
  
  ### New Tables
  - `job_assignments` - Tracks which crew members are assigned to which jobs
    - `id` (uuid, primary key)
    - `lead_id` (uuid, foreign key to leads) - The job
    - `user_id` (uuid, foreign key to auth.users) - The assigned crew member
    - `account_id` (uuid, foreign key to accounts)
    - `assigned_by` (uuid, foreign key to auth.users) - Who made the assignment
    - `assigned_at` (timestamptz) - When they were assigned
    - `notes` (text) - Optional notes about the assignment
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  ### Modified Tables
  - account_members: Change default role from 'admin' to handle crew member invites
  
  ## Security
  - Enable RLS on job_assignments table
  - Add policies for crew leads and admins to manage assignments
  - Add policies for crew members to view their own assignments
  - Update leads RLS policies to allow crew members to see assigned jobs
  
  ## Notes
  - Only crew leads, admins, and owners can assign crew members to jobs
  - Crew members can only see jobs they're assigned to
  - Each crew member can be assigned to multiple jobs
  - Each job can have multiple crew members assigned
*/

-- Add crew_member to app_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'crew_member' 
    AND enumtypid = 'app_role'::regtype
  ) THEN
    ALTER TYPE app_role ADD VALUE 'crew_member';
  END IF;
END $$;

-- Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(lead_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_assignments_lead_id ON job_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_account_id ON job_assignments(account_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_job_assignments_updated_at ON job_assignments;
CREATE TRIGGER update_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_assignments

-- Account members can view assignments in their account
CREATE POLICY "Account members can view job assignments"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Crew leads, admins, and owners can create assignments
CREATE POLICY "Managers can create job assignments"
  ON job_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
      AND role IN ('owner', 'admin', 'crew_lead')
    )
    AND lead_id IN (
      SELECT id FROM leads WHERE account_id = job_assignments.account_id
    )
    AND user_id IN (
      SELECT user_id FROM account_members 
      WHERE account_id = job_assignments.account_id 
      AND is_active = true
    )
  );

-- Crew leads, admins, and owners can update assignments
CREATE POLICY "Managers can update job assignments"
  ON job_assignments FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
      AND role IN ('owner', 'admin', 'crew_lead')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
      AND role IN ('owner', 'admin', 'crew_lead')
    )
  );

-- Crew leads, admins, and owners can delete assignments
CREATE POLICY "Managers can delete job assignments"
  ON job_assignments FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
      AND role IN ('owner', 'admin', 'crew_lead')
    )
  );

-- Update leads RLS policies to allow crew members to see their assigned jobs

-- Drop and recreate the SELECT policy for leads to include crew member access
DROP POLICY IF EXISTS "Account members can view leads" ON leads;

CREATE POLICY "Account members can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM account_members am
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
      AND am.role IN ('owner', 'admin', 'sales', 'crew_lead')
    )
    OR
    id IN (
      SELECT ja.lead_id FROM job_assignments ja
      WHERE ja.user_id = auth.uid()
    )
  );

-- Update job_schedules RLS policies to allow crew members to see schedules for their assigned jobs

DROP POLICY IF EXISTS "Account members can view their job schedules" ON job_schedules;

CREATE POLICY "Account members can view their job schedules"
  ON job_schedules FOR SELECT
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

-- Helper function to check if user has management role
CREATE OR REPLACE FUNCTION is_manager(
  account_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = account_id_param
    AND user_id = user_id_param
    AND is_active = true
    AND role IN ('owner', 'admin', 'crew_lead')
  );
$$;

-- Helper function to get user's assigned job IDs
CREATE OR REPLACE FUNCTION get_user_assigned_jobs(
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS TABLE (lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ja.lead_id
  FROM job_assignments ja
  WHERE ja.user_id = user_id_param;
$$;

-- Add helpful comments
COMMENT ON TABLE job_assignments IS 'Tracks which crew members are assigned to which jobs';
COMMENT ON COLUMN job_assignments.lead_id IS 'The job (lead) being assigned';
COMMENT ON COLUMN job_assignments.user_id IS 'The crew member being assigned to the job';
COMMENT ON COLUMN job_assignments.assigned_by IS 'The manager who made the assignment';
