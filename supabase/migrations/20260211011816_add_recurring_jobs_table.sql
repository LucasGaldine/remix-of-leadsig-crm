/*
  # Add Recurring Jobs Support

  1. New Tables
    - `recurring_jobs`
      - `id` (uuid, primary key)
      - `account_id` (uuid, FK to accounts)
      - `customer_id` (uuid, FK to customers)
      - `name` (text) - job name template
      - `service_type` (text)
      - `address` (text)
      - `description` (text)
      - `frequency` (text) - 'weekly', 'biweekly', 'monthly'
      - `scheduled_time_start` (time) - default start time for instances
      - `scheduled_time_end` (time) - default end time for instances
      - `start_date` (date) - when recurring job begins
      - `end_date` (date, nullable) - null = indefinite
      - `default_crew_user_ids` (jsonb) - array of user_ids for default crew
      - `estimated_value` (numeric)
      - `is_active` (boolean) - can pause/stop recurring generation
      - `instances_ahead` (int) - how many future instances to maintain (default 4)
      - `created_by` (uuid)
      - `created_at`, `updated_at` (timestamps)

  2. Modified Tables
    - `leads`
      - `recurring_job_id` (uuid, FK to recurring_jobs) - links instance to template
      - `recurring_instance_number` (int) - sequence number

  3. Security
    - Enable RLS on `recurring_jobs`
    - Policies for authenticated users scoped to their account
*/

-- Create recurring_jobs table
CREATE TABLE IF NOT EXISTS recurring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_type text,
  address text,
  description text,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  scheduled_time_start time,
  scheduled_time_end time,
  start_date date NOT NULL,
  end_date date,
  default_crew_user_ids jsonb DEFAULT '[]'::jsonb,
  estimated_value numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  instances_ahead int NOT NULL DEFAULT 4,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view recurring jobs in their account"
  ON recurring_jobs FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can create recurring jobs in their account"
  ON recurring_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update recurring jobs in their account"
  ON recurring_jobs FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can delete recurring jobs in their account"
  ON recurring_jobs FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Add columns to leads table for recurring job tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'recurring_job_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN recurring_job_id uuid REFERENCES recurring_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'recurring_instance_number'
  ) THEN
    ALTER TABLE leads ADD COLUMN recurring_instance_number int;
  END IF;
END $$;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_leads_recurring_job_id ON leads(recurring_job_id) WHERE recurring_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_account_id ON recurring_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_is_active ON recurring_jobs(account_id, is_active) WHERE is_active = true;
