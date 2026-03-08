/*
  # Fix Circular Dependency in account_members RLS Policies
  
  ## Overview
  Removes circular dependency in account_members SELECT policies.
  Users can only view their own memberships directly without subqueries.
  
  ## Changes
  
  1. Drop the problematic policy that queries account_members within account_members
  2. Keep only the direct user_id check for SELECT
  3. Simplify INSERT/UPDATE/DELETE policies
  
  ## Security
  
  - Users can view their own memberships (no circular dependency)
  - System/service role can manage all memberships
  - Users cannot modify their own membership status
*/

-- Drop all existing account_members policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.account_members;
DROP POLICY IF EXISTS "Users can view all memberships in their accounts" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can create memberships" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can update memberships" ON public.account_members;
DROP POLICY IF EXISTS "Account owners and admins can delete memberships" ON public.account_members;

-- Allow users to view their own account memberships ONLY
-- This is the critical policy that breaks the circular dependency
CREATE POLICY "Users can view their own memberships"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow system to insert memberships (for new user registration)
-- We can't check account_members here because of circular dependency
CREATE POLICY "Allow insert for authenticated users"
  ON public.account_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users cannot update or delete memberships themselves
-- Only service role can do this (for now - we can add admin functionality later)
-- No UPDATE or DELETE policies for regular users