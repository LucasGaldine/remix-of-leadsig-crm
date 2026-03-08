/*
  # Update Accounts Table RLS Policies
  
  ## Overview
  Update accounts table RLS policies to use the security definer functions
  
  ## Changes
  - Users can view their own account
  - Users can update their own account
  - Use security definer functions instead of direct queries
  
  ## Security
  - No circular dependencies
  - Users can only access their own account data
*/

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;
DROP POLICY IF EXISTS "Users can view accounts they are members of" ON public.accounts;
DROP POLICY IF EXISTS "Account owners and admins can update their account" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;

-- Create new policies using security definer function
CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update their own account"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    id = get_user_account_id(auth.uid())
  );

-- Allow users to insert accounts (for new account creation)
CREATE POLICY "Users can create accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);