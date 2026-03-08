/*
  # Fix Account Members SELECT Policy to Show All Team Members

  1. Problem
    - Current policy only allows users to view their own membership record
    - This prevents the crew assignment dialog from showing all available crew members
    - Users can only see themselves in the dropdown

  2. Solution
    - Update the SELECT policy to allow users to view all members in their account(s)
    - Use the security definer function to check account membership without circular dependency

  3. Security
    - Users can only view members from accounts they belong to
    - Maintains proper isolation between different accounts
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own membership record" ON public.account_members;

-- Create new policy that allows viewing all members in the same account
CREATE POLICY "Users can view members in their accounts"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (
    is_account_member(account_id, auth.uid())
  );