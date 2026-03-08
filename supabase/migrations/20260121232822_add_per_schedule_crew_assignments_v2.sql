/*
  # Add Per-Schedule Crew Assignments
  
  ## Overview
  Updates job_assignments to support assigning crew members to specific job schedules
  rather than entire jobs. This allows different crew members to work different days
  of multi-day jobs.
  
  ## Changes Made
  
  1. Schema Changes
    - Add job_schedule_id column to job_assignments
    - Keep lead_id for backwards compatibility and easier querying
    - Replace unique constraint from (lead_id, user_id) to (job_schedule_id, user_id)
  
  2. Overlap Detection
    - Create function to check if a user has overlapping assignments
    - Prevents double-booking crew members
  
  3. RLS Policies
    - Update policies to work with schedule-based assignments
  
  ## Security
  - Maintain existing RLS policies with schedule validation
  - Add overlap check in INSERT policy
*/

ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS job_schedule_id uuid REFERENCES job_schedules(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_job_assignments_schedule 
ON job_assignments(job_schedule_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_user_schedule 
ON job_assignments(user_id, job_schedule_id);

ALTER TABLE job_assignments 
DROP CONSTRAINT IF EXISTS job_assignments_lead_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_schedule_user_unique
ON job_assignments(job_schedule_id, user_id)
WHERE job_schedule_id IS NOT NULL;

CREATE OR REPLACE FUNCTION check_assignment_overlap(
  p_user_id uuid,
  p_schedule_id uuid,
  p_account_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM job_assignments ja
    JOIN job_schedules js1 ON ja.job_schedule_id = js1.id
    JOIN job_schedules js2 ON js2.id = p_schedule_id
    WHERE ja.user_id = p_user_id
    AND ja.account_id = p_account_id
    AND js1.scheduled_date = js2.scheduled_date
    AND (
      (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
      OR
      (
        js1.scheduled_time_start < js2.scheduled_time_end
        AND js1.scheduled_time_end > js2.scheduled_time_start
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION is_schedule_in_account(p_schedule_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM job_schedules 
    WHERE id = p_schedule_id 
    AND account_id = p_account_id
  );
$$;

DROP POLICY IF EXISTS "Managers can create job assignments" ON job_assignments;

CREATE POLICY "Managers can create job assignments"
  ON job_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_account_manager(account_id, auth.uid())
    AND (lead_id IS NULL OR is_lead_in_account(lead_id, account_id))
    AND (job_schedule_id IS NULL OR is_schedule_in_account(job_schedule_id, account_id))
    AND is_user_in_account(user_id, account_id)
    AND (job_schedule_id IS NULL OR NOT check_assignment_overlap(user_id, job_schedule_id, account_id))
  );