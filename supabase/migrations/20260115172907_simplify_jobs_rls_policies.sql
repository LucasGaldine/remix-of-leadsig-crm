/*
  # Simplify Jobs RLS Policies

  1. Changes
    - Drop all restrictive RLS policies on leads table
    - Keep only the simple policy that allows authenticated users full access
  
  2. Security
    - Authenticated users can view, create, update, and delete all leads/jobs
    - No ownership or assignment checks required
*/

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Users can view their leads and jobs" ON leads;
DROP POLICY IF EXISTS "Users can create leads and jobs" ON leads;
DROP POLICY IF EXISTS "Users can update their leads and jobs" ON leads;
DROP POLICY IF EXISTS "Users can delete their leads and jobs" ON leads;

-- Ensure the permissive "all access" policy exists
DROP POLICY IF EXISTS "Authenticated users have full access to leads" ON leads;

CREATE POLICY "Authenticated users have full access to leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
