/*
  # Allow Sales Users to Create Job Assignments

  ## Overview
  This migration updates the RLS policy for job_assignments to allow users with the 'sales' role
  to create job assignments when scheduling jobs and estimate visits.

  ## Changes Made
  
  1. Update is_user_account_manager Function
    - Add 'sales' to the list of roles that can create job assignments
    - This allows sales users to assign crew members when scheduling estimate visits and jobs

  ## Security
  - Maintains existing checks for account membership and active status
  - Only allows sales users to assign crew within their own account
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
    AND role IN ('owner', 'admin', 'crew_lead', 'sales')
  );
$$;
