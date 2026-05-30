-- Fix local/API access after security hardening:
-- 1) restore execute grants required by RLS helper functions
-- 2) remove recursive customers SELECT policy that queries customers within itself

GRANT EXECUTE ON FUNCTION public.user_is_account_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_account_owner_or_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view customers in their account" ON public.customers;

CREATE POLICY "Users can view customers in their account"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR user_is_account_member(account_id)
  );
