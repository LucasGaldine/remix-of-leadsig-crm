/*
  # Restrict Leads to User Account

  1. Changes
    - Drop the permissive "all access" policy
    - Create new policies that restrict leads to the user who created them
    - Users can only see, update, and delete their own leads
    - When inserting, created_by must match the authenticated user
  
  2. Security
    - SELECT: Users can only view leads they created (created_by = auth.uid())
    - INSERT: Users can create leads, and created_by must be their user ID
    - UPDATE: Users can only update their own leads
    - DELETE: Users can only delete their own leads
*/

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users have full access to leads" ON leads;

-- Create restrictive policies for each operation
CREATE POLICY "Users can view their own leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create leads for themselves"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
