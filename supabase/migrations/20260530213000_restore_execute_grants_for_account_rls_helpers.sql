-- Restore execute permissions required by RLS policies on account-scoped tables.
-- Without these grants, authenticated requests can fail with 403 when policies call
-- helper functions like is_account_member/is_account_admin.

GRANT EXECUTE ON FUNCTION public.is_account_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_admin(uuid, uuid) TO authenticated;
