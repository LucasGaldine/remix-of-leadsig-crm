/*
  # Harden SECURITY DEFINER RPC exposure

  - Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC/anon/authenticated.
  - Re-grant only explicit anon allowlist for public RPCs.
  - Keep service_role execution for server-side workflows.
  - Lock future default privileges for functions in public schema.
*/

BEGIN;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

-- Keep only intentional public RPC entrypoints.
GRANT EXECUTE ON FUNCTION public.get_public_site(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_account_by_invite_code(text) TO anon;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_affiliate_signup'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text, text, text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_affiliate_signup(text, text, text, text) TO anon';
  ELSIF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_affiliate_signup'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text, text'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_affiliate_signup(text, text, text) TO anon';
  END IF;
END;
$$;

-- Explicitly ensure trigger/internal and admin helpers are not RPC-executable.
REVOKE EXECUTE ON FUNCTION public.enforce_website_lead_pending_approval() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_declined_notifications() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_mark_account_upgraded(uuid, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_all_accounts_for_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) FROM anon, authenticated, PUBLIC;

-- Prevent future PUBLIC execute defaults.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    current_user
  );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  END IF;
END;
$$;

COMMIT;
