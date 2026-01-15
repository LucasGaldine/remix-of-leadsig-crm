/*
  # Add RLS policy for customer creators

  1. Security Changes
    - Add policy to allow users to view and manage customers they created
    - This allows users to see customer data for jobs they create
    - Users can see customers where they are the creator (created_by field)

  2. Notes
    - This complements existing role-based policies
    - Ensures the job detail view can load customer data
    - Follows the principle of least privilege
*/

DROP POLICY IF EXISTS "Users can view and manage customers they created" ON public.customers;

CREATE POLICY "Users can view and manage customers they created" 
  ON public.customers 
  TO authenticated 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());