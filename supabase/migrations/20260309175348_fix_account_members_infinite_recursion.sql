/*
  # Fix Account Members Infinite Recursion

  1. Problem
    - The RLS policy for account_members is querying account_members in its USING clause
    - This creates infinite recursion when trying to access the table
    
  2. Solution
    - Use the existing security definer function `is_account_member()` 
    - This function bypasses RLS to safely check membership without recursion
    
  3. Security
    - Users can only view members from accounts they belong to
    - Maintains proper isolation between accounts
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own or account memberships" ON account_members;

-- Create the correct policy using the security definer function
CREATE POLICY "Users can view members in their accounts"
  ON account_members
  FOR SELECT
  TO authenticated
  USING (
    is_account_member(account_id, (select auth.uid()))
  );
