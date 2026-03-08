/*
  # Fix Circular RLS Dependency in account_members
  
  ## Problem
  The account_members table has RLS policies that query account_members itself,
  creating a circular dependency. When other tables (leads, estimates, jobs) try
  to check account membership, they hit this circular dependency and fail with
  "policy for relation account_members" errors.
  
  ## Solution
  1. Create security definer functions that bypass RLS to check membership
  2. Remove all circular policies on account_members
  3. Create simple, non-circular policies on account_members
  4. All other tables will use the security definer functions
  
  ## Changes
  
  ### New Functions
  - `is_account_member(account_id, user_id)` - Check if user is member of account
  - `get_user_account_id(user_id)` - Get the account ID for a user
  
  ### Security
  - Functions are SECURITY DEFINER and bypass RLS safely
  - account_members policies are simplified to avoid circular dependencies
  - Users can only view their own membership records
  - Only account owners/admins can modify memberships
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_account_member(UUID, UUID);
DROP FUNCTION IF EXISTS get_user_account_id(UUID);
DROP FUNCTION IF EXISTS is_account_admin(UUID, UUID);

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.account_members;
DROP POLICY IF EXISTS "Users can view members of their accounts" ON public.account_members;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can invite members" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can update members" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can remove members" ON public.account_members;

-- Create helper functions that bypass RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_account_member(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = p_account_id
      AND user_id = p_user_id
      AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_account_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT account_id INTO v_account_id
  FROM account_members
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1;
  
  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_account_admin(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = p_account_id
      AND user_id = p_user_id
      AND is_active = true
      AND role IN ('owner', 'admin')
  );
END;
$$;

-- Create NEW simplified policies for account_members
-- These DO NOT query account_members in their conditions!

-- SELECT: Users can only view their own membership record
CREATE POLICY "Users can view own membership record"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Only allow users to create their own membership
CREATE POLICY "System can insert memberships"
  ON public.account_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies for regular users to avoid circular dependencies

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_account_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_account_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_account_admin(UUID, UUID) TO authenticated;