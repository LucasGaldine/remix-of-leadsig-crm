/*
  # Add Multi-Day Job Scheduling

  ## Summary
  This migration enables jobs to be scheduled across multiple days/times and automatically
  marks them as complete when the last scheduled date/time has passed.

  ## Changes
  
  ### New Tables
  - `job_schedules` - Stores multiple scheduled dates/times for each job
    - `id` (uuid, primary key)
    - `lead_id` (uuid, foreign key to leads) - The job this schedule belongs to
    - `scheduled_date` (date) - The date of this scheduled work session
    - `scheduled_time_start` (time) - Start time (optional)
    - `scheduled_time_end` (time) - End time (optional)
    - `notes` (text) - Optional notes for this specific day's work
    - `is_completed` (boolean) - Whether this specific day's work is done
    - `completed_at` (timestamptz) - When this day was marked complete
    - `created_by` (uuid, foreign key to users)
    - `account_id` (uuid, foreign key to accounts)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### Functions
  - `update_job_completion_status()` - Trigger function that automatically marks a job as
    complete when current date/time is after the last scheduled date/time

  ### Triggers
  - Auto-update job status when schedules are added/modified/deleted

  ## Security
  - Enable RLS on job_schedules table
  - Add policies for account members to manage their schedules
  - Validate schedule dates are associated with existing jobs

  ## Migration of Existing Data
  - Migrate existing single-date schedules from leads table to job_schedules table
*/

-- Create job_schedules table
CREATE TABLE IF NOT EXISTS job_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time_start time,
  scheduled_time_end time,
  notes text,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_schedules_lead_id ON job_schedules(lead_id);
CREATE INDEX IF NOT EXISTS idx_job_schedules_scheduled_date ON job_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_job_schedules_account_id ON job_schedules(account_id);

-- Enable RLS
ALTER TABLE job_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_schedules
CREATE POLICY "Account members can view their job schedules"
  ON job_schedules FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create job schedules"
  ON job_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
    AND lead_id IN (
      SELECT id FROM leads WHERE account_id = job_schedules.account_id
    )
  );

CREATE POLICY "Account members can update their job schedules"
  ON job_schedules FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete their job schedules"
  ON job_schedules FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Function to automatically update job completion status
CREATE OR REPLACE FUNCTION update_job_completion_status()
RETURNS trigger AS $$
DECLARE
  last_schedule_datetime timestamptz;
  job_status text;
BEGIN
  -- Get the latest scheduled datetime for this job
  SELECT 
    CASE 
      WHEN scheduled_time_end IS NOT NULL THEN
        (scheduled_date || ' ' || scheduled_time_end)::timestamptz
      ELSE
        (scheduled_date || ' 23:59:59')::timestamptz
    END INTO last_schedule_datetime
  FROM job_schedules
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  ORDER BY scheduled_date DESC, scheduled_time_end DESC NULLS LAST
  LIMIT 1;

  -- If no schedules exist, do nothing
  IF last_schedule_datetime IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get current job status
  SELECT status INTO job_status
  FROM leads
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);

  -- If current time is after the last scheduled datetime and job is not already completed
  IF now() > last_schedule_datetime AND job_status != 'completed' THEN
    UPDATE leads
    SET status = 'completed', updated_at = now()
    WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update job status after schedule changes
DROP TRIGGER IF EXISTS trigger_update_job_completion ON job_schedules;
CREATE TRIGGER trigger_update_job_completion
  AFTER INSERT OR UPDATE OR DELETE ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_job_completion_status();

-- Add constraint to prevent invoice creation for non-completed jobs
CREATE OR REPLACE FUNCTION validate_invoice_job_completion()
RETURNS trigger AS $$
DECLARE
  job_status text;
BEGIN
  -- If there's a lead_id, check if the job is completed
  IF NEW.lead_id IS NOT NULL THEN
    SELECT status INTO job_status
    FROM leads
    WHERE id = NEW.lead_id;

    IF job_status != 'completed' AND job_status != 'invoiced' AND job_status != 'paid' THEN
      RAISE EXCEPTION 'Cannot create invoice for job that is not completed. Current status: %', job_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate invoice creation
DROP TRIGGER IF EXISTS trigger_validate_invoice_completion ON invoices;
CREATE TRIGGER trigger_validate_invoice_completion
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_job_completion();

-- Migrate existing single-date schedules to job_schedules table
INSERT INTO job_schedules (lead_id, scheduled_date, scheduled_time_start, scheduled_time_end, created_by, account_id)
SELECT 
  id,
  scheduled_date,
  scheduled_time_start,
  scheduled_time_end,
  created_by,
  account_id
FROM leads
WHERE scheduled_date IS NOT NULL
  AND account_id IS NOT NULL
  AND created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE job_schedules IS 'Stores multiple scheduled work dates/times for jobs, enabling multi-day project scheduling';
COMMENT ON COLUMN job_schedules.lead_id IS 'The job (lead) this schedule entry belongs to';
COMMENT ON COLUMN job_schedules.is_completed IS 'Whether work for this specific day has been completed';
