
-- Create job time entries table for per-user GPS-based time tracking
CREATE TABLE public.job_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
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

-- Indexes
CREATE INDEX idx_job_time_entries_lead_id ON public.job_time_entries(lead_id);
CREATE INDEX idx_job_time_entries_user_id ON public.job_time_entries(user_id);

-- Enable RLS
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;

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
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
ON public.job_time_entries FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Timestamp trigger
CREATE TRIGGER update_job_time_entries_updated_at
BEFORE UPDATE ON public.job_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_time_entries;
