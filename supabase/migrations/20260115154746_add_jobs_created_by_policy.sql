/*
  # Add RLS policy for job creators

  1. Security Changes
    - Add policy to allow users to view and manage jobs they created
    - This allows the job creation flow to work properly
    - Users can see jobs where they are the creator (created_by field)

  2. Notes
    - This complements existing role-based policies
    - Ensures users who create jobs can immediately view them
    - Follows the principle of least privilege
*/

DROP POLICY IF EXISTS "Users can view and manage jobs they created" ON public.jobs;

CREATE POLICY "Users can view and manage jobs they created" 
  ON public.jobs 
  TO authenticated 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());