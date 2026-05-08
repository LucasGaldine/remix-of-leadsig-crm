/*
  # Fix account_members RLS recursion

  ## Problem
  Updating account_members can fail with:
  infinite recursion detected in policy for relation "account_members"

  ## Root cause
  UPDATE/INSERT/DELETE policies on account_members queried account_members directly,
  which triggers recursive RLS evaluation.

  ## Fix
  Replace self-referencing policy expressions with SECURITY DEFINER helper
  function calls.
*/

DROP POLICY IF EXISTS "Managers can invite members" ON public.account_members;
DROP POLICY IF EXISTS "Managers can update members" ON public.account_members;
DROP POLICY IF EXISTS "Managers can remove members" ON public.account_members;

CREATE POLICY "Managers can invite members"
  ON public.account_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_account_admin(account_members.account_id, auth.uid()));

CREATE POLICY "Managers can update members"
  ON public.account_members
  FOR UPDATE
  TO authenticated
  USING (public.is_account_admin(account_members.account_id, auth.uid()))
  WITH CHECK (public.is_account_admin(account_members.account_id, auth.uid()));

CREATE POLICY "Managers can remove members"
  ON public.account_members
  FOR DELETE
  TO authenticated
  USING (public.is_account_admin(account_members.account_id, auth.uid()));;
