BEGIN;

-- Fix mutable search_path on exact function signature flagged by advisor.
ALTER FUNCTION public.normalize_hiring_roles_status(jsonb) SET search_path = public;

-- Ensure candidates table has scoped RLS policies.
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can delete candidates" ON public.candidates;

CREATE POLICY "Authenticated users can view candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (
  owner_hr_id = auth.uid()
  OR assigned_interviewer_id = auth.uid()
);

CREATE POLICY "Authenticated users can insert candidates"
ON public.candidates
FOR INSERT
TO authenticated
WITH CHECK (
  owner_hr_id = auth.uid()
  OR assigned_interviewer_id = auth.uid()
);

CREATE POLICY "Authenticated users can update candidates"
ON public.candidates
FOR UPDATE
TO authenticated
USING (
  owner_hr_id = auth.uid()
  OR assigned_interviewer_id = auth.uid()
)
WITH CHECK (
  owner_hr_id = auth.uid()
  OR assigned_interviewer_id = auth.uid()
);

CREATE POLICY "Authenticated users can delete candidates"
ON public.candidates
FOR DELETE
TO authenticated
USING (
  owner_hr_id = auth.uid()
  OR assigned_interviewer_id = auth.uid()
);

COMMIT;
