
-- Add columns to jobs table
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS quoted_hours INT;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS actual_hours INT;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS quoted_cost DECIMAL;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS actual_cost DECIMAL;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS delay_reason TEXT;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS status TEXT;

-- Add columns to crew_members table
ALTER TABLE IF EXISTS public.crew_members ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL;
ALTER TABLE IF EXISTS public.crew_members ADD COLUMN IF NOT EXISTS role_type TEXT;

-- Add columns to payments table
ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP;

-- Add columns to leads table
ALTER TABLE IF EXISTS public.leads ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE IF EXISTS public.leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP;

-- Create job_crew_assignments table
CREATE TABLE IF NOT EXISTS public.job_crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  crew_member_id UUID,
  account_id UUID,
  hours_worked DECIMAL,
  date DATE,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS on new table
ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_crew_assignments
CREATE POLICY "Users can view own account crew assignments"
  ON public.job_crew_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert crew assignments"
  ON public.job_crew_assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update crew assignments"
  ON public.job_crew_assignments
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete crew assignments"
  ON public.job_crew_assignments
  FOR DELETE
  USING (true);
