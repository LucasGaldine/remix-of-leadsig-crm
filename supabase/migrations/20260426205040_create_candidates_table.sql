DO $$
BEGIN
  CREATE TYPE public.candidate_stage AS ENUM (
    'new_applicant',
    'screening',
    'phone_screening',
    'in_person_interview',
    'i9_documentation',
    'trial_day_scheduled',
    'trial_day_completed',
    'hired',
    'active_employee',
    'rejected',
    'on_hold'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.workbright_status AS ENUM ('not_sent', 'invited', 'in_progress', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  current_stage public.candidate_stage NOT NULL DEFAULT 'new_applicant',
  previous_stage public.candidate_stage,
  owner_hr_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_interviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  final_decision TEXT,
  notes TEXT,
  interview_availability TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  job_posting_id UUID,
  workbright_status public.workbright_status NOT NULL DEFAULT 'not_sent',
  workbright_candidate_id TEXT,
  workbright_profile_url TEXT,
  workbright_invite_sent_at TIMESTAMPTZ,
  workbright_completed_at TIMESTAMPTZ,
  workbright_last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_stage ON public.candidates(current_stage);
CREATE INDEX IF NOT EXISTS idx_candidates_owner ON public.candidates(owner_hr_id);
CREATE INDEX IF NOT EXISTS idx_candidates_interviewer ON public.candidates(assigned_interviewer_id);
CREATE INDEX IF NOT EXISTS idx_candidates_last_activity ON public.candidates(last_activity_at);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'candidates'
      AND policyname = 'Authenticated users can manage candidates'
  ) THEN
    CREATE POLICY "Authenticated users can manage candidates"
      ON public.candidates
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;;
