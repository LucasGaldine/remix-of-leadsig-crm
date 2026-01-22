/*
  # Add Availability Settings

  1. New Tables
    - `business_hours`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references accounts)
      - `day_of_week` (integer, 0=Sunday, 6=Saturday)
      - `start_time` (time)
      - `end_time` (time)
      - `is_closed` (boolean, whether business is closed this day)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `days_off`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references accounts)
      - `date` (date, the day off)
      - `reason` (text, optional description like "Christmas", "Vacation")
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only account members can view/manage their account's availability
    - Cannot delete a day off if jobs are scheduled on that date

  3. Constraints
    - Unique constraint on business_hours per account per day
    - Unique constraint on days_off per account per date
    - Check constraint that start_time < end_time when not closed
*/

-- Create business_hours table
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time,
  end_time time,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (
    is_closed = true OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  ),
  CONSTRAINT unique_account_day UNIQUE (account_id, day_of_week)
);

-- Create days_off table
CREATE TABLE IF NOT EXISTS days_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_account_date UNIQUE (account_id, date)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_business_hours_account ON business_hours(account_id);
CREATE INDEX IF NOT EXISTS idx_days_off_account ON days_off(account_id);
CREATE INDEX IF NOT EXISTS idx_days_off_date ON days_off(account_id, date);

-- Enable RLS
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE days_off ENABLE ROW LEVEL SECURITY;

-- Business hours policies
CREATE POLICY "Account members can view business hours"
  ON business_hours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = business_hours.account_id
      AND account_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Account owners can insert business hours"
  ON business_hours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = business_hours.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

CREATE POLICY "Account owners can update business hours"
  ON business_hours FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = business_hours.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = business_hours.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

CREATE POLICY "Account owners can delete business hours"
  ON business_hours FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = business_hours.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

-- Days off policies
CREATE POLICY "Account members can view days off"
  ON days_off FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = days_off.account_id
      AND account_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Account owners can insert days off"
  ON days_off FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = days_off.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

CREATE POLICY "Account owners can update days off"
  ON days_off FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = days_off.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = days_off.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

CREATE POLICY "Account owners can delete days off"
  ON days_off FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = days_off.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.role = 'owner'
    )
  );

-- Function to prevent deleting days off when jobs are scheduled
CREATE OR REPLACE FUNCTION check_no_jobs_on_day_off()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM job_schedules
    WHERE job_schedules.account_id = OLD.account_id
    AND job_schedules.scheduled_date = OLD.date
  ) THEN
    RAISE EXCEPTION 'Cannot add day off: jobs are already scheduled on %', OLD.date;
  END IF;
  RETURN OLD;
END;
$$;

-- Add trigger to prevent deleting days off with scheduled jobs
DROP TRIGGER IF EXISTS prevent_day_off_with_jobs ON days_off;
CREATE TRIGGER prevent_day_off_with_jobs
  BEFORE DELETE ON days_off
  FOR EACH ROW
  EXECUTE FUNCTION check_no_jobs_on_day_off();

-- Function to check if a date is a day off
CREATE OR REPLACE FUNCTION is_day_off(p_account_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM days_off
    WHERE account_id = p_account_id
    AND date = p_date
  );
$$;