/*
  # Add RLS Policies for account_members and accounts tables
  
  ## Overview
  Adds RLS policies to allow users to:
  - View their own account memberships
  - View accounts they are members of
  - Owners/admins can manage members
  
  ## Changes
  
  1. Enable RLS on account_members and accounts (if not already enabled)
  2. Add policies for account_members table
  3. Add policies for accounts table
  
  ## Security
  
  - Users can view their own memberships and accounts
  - Only owners/admins can modify memberships
  - Account information visible to all members
*/

-- Enable RLS on account_members if not already enabled
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Enable RLS on accounts if not already enabled
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.account_members;
DROP POLICY IF EXISTS "Users can view all memberships in their accounts" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can create memberships" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can update memberships" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can delete memberships" ON public.account_members;

-- Allow users to view their own account memberships
CREATE POLICY "Users can view their own memberships"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users to view all memberships in accounts they belong to
CREATE POLICY "Users can view all memberships in their accounts"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only owners and admins can add new members
CREATE POLICY "Account owners and admins can create memberships"
  ON public.account_members FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can update memberships
CREATE POLICY "Account owners and admins can update memberships"
  ON public.account_members FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can delete memberships
CREATE POLICY "Account owners and admins can delete memberships"
  ON public.account_members FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Drop existing account policies if any
DROP POLICY IF EXISTS "Users can view their accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;
DROP POLICY IF EXISTS "Account owners and admins can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Account owners can delete accounts" ON public.accounts;

-- Allow users to view accounts they are members of
CREATE POLICY "Users can view their accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated users to create accounts (for sign-up)
CREATE POLICY "Users can create accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only owners and admins can update account details
CREATE POLICY "Account owners and admins can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Only owners can delete accounts
CREATE POLICY "Account owners can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role = 'owner'
    )
  );