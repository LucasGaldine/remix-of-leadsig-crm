/*
  # Fix Leads Delete Policy

  ## Problem
  The DELETE policy for leads is too restrictive - it only allows account owners
  and admins to delete leads. However, regular account members can create and update
  leads, so they should also be able to delete them.

  ## Changes
  
  1. **Update leads DELETE policy**
     - Change from `user_is_account_owner_or_admin` to `user_is_account_member`
     - This aligns with the UPDATE policy and allows any team member to delete leads
  
  ## Notes
  - This makes the permission model consistent: if you can create and edit, you can delete
  - All operations still require account membership for security
*/

-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Account owners and admins can delete leads" ON public.leads;

-- Create new policy that allows any account member to delete
CREATE POLICY "Account members can delete leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));