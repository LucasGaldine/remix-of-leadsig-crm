/*
  # Create Job Time Entries Table for Time Tracking

  1. New Tables
    - `job_time_entries`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `user_id` (uuid, foreign key to auth.users)
      - `account_id` (uuid, foreign key to accounts)
      - `clock_in` (timestamptz)
      - `clock_out` (timestamptz, nullable)
      - `is_auto` (boolean) - Whether this was auto-clocked via GPS
      - `clock_in_lat` (double precision, nullable) - GPS coordinates
      - `clock_in_lng` (double precision, nullable)
      - `clock_out_lat` (double precision, nullable)
      - `clock_out_lng` (double precision, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `job_time_entries` table
    - Add policies for authenticated users to manage their own time entries
    
  3. Indexes
    - Index on lead_id for faster lookups
    - Index on user_id for faster user-specific queries
    - Index on account_id for account-level queries
*/

-- Create the table
CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out TIMESTAMP WITH TIME ZONE,
  is_auto BOOLEAN NOT NULL DEFAULT true,
  clock_in_lat DOUBLE PRECISION,
  clock_in_lng DOUBLE PRECISION,
  clock_out_lat DOUBLE PRECISION,
  clock_out_lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_time_entries_lead_id ON public.job_time_entries(lead_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_user_id ON public.job_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_account_id ON public.job_time_entries(account_id);

-- Enable RLS
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own time entries" ON public.job_time_entries;
DROP POLICY IF EXISTS "Users can create own time entries" ON public.job_time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON public.job_time_entries;
DROP POLICY IF EXISTS "Users can delete own time entries" ON public.job_time_entries;

-- Create policies for users to manage their own time entries
CREATE POLICY "Users can view own time entries"
ON public.job_time_entries FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own time entries"
ON public.job_time_entries FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries"
ON public.job_time_entries FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
ON public.job_time_entries FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update the updated_at timestamp
DROP TRIGGER IF EXISTS update_job_time_entries_updated_at ON public.job_time_entries;
CREATE TRIGGER update_job_time_entries_updated_at
BEFORE UPDATE ON public.job_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
