
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can insert crew assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Users can update crew assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Users can delete crew assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Users can view own account crew assignments" ON public.job_crew_assignments;

-- Recreate with proper account-based checks
CREATE POLICY "Users can view crew assignments in account"
  ON public.job_crew_assignments
  FOR SELECT
  USING (account_id IN (
    SELECT account_id FROM public.customers WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can insert crew assignments in account"
  ON public.job_crew_assignments
  FOR INSERT
  WITH CHECK (account_id IN (
    SELECT account_id FROM public.customers WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can update crew assignments in account"
  ON public.job_crew_assignments
  FOR UPDATE
  USING (account_id IN (
    SELECT account_id FROM public.customers WHERE created_by = auth.uid()
  ));

CREATE POLICY "Users can delete crew assignments in account"
  ON public.job_crew_assignments
  FOR DELETE
  USING (account_id IN (
    SELECT account_id FROM public.customers WHERE created_by = auth.uid()
  ));
