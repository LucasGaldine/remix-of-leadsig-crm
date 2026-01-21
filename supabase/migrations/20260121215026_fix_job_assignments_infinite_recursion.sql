/*
  # Fix Job Assignments Infinite Recursion
  
  ## Overview
  Fixes infinite recursion error in job_assignments INSERT policy by using
  security definer functions to validate relationships without creating
  circular dependencies.
  
  ## Changes
  - Create helper functions with SECURITY DEFINER to check relationships
  - Update INSERT policy to use these functions instead of inline subqueries
  
  ## Security
  - Functions use SECURITY DEFINER to avoid RLS recursion
  - Still maintain proper access control by checking account membership
*/

CREATE OR REPLACE FUNCTION is_user_account_manager(p_account_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM account_members 
    WHERE account_id = p_account_id 
    AND user_id = p_user_id
    AND is_active = true 
    AND role IN ('owner', 'admin', 'crew_lead')
  );
$$;

CREATE OR REPLACE FUNCTION is_lead_in_account(p_lead_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM leads 
    WHERE id = p_lead_id 
    AND account_id = p_account_id
  );
$$;

CREATE OR REPLACE FUNCTION is_user_in_account(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM account_members 
    WHERE user_id = p_user_id 
    AND account_id = p_account_id 
    AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "Managers can create job assignments" ON job_assignments;

CREATE POLICY "Managers can create job assignments"
  ON job_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_account_manager(account_id, auth.uid())
    AND is_lead_in_account(lead_id, account_id)
    AND is_user_in_account(user_id, account_id)
  );