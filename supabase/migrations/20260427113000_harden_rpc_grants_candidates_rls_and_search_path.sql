/*
  # Security hardening: RPC grants, candidates RLS, and function search_path

  ## Changes
  - Revoke broad function execute privileges from PUBLIC/anon/authenticated.
  - Re-grant execute only for explicitly allowlisted RPC functions used by the app.
  - Lock future default function privileges to avoid reintroducing PUBLIC execute.
  - Replace permissive `public.candidates` policy if the table exists.
  - Set explicit search_path for flagged functions.
*/

BEGIN;

-- 1) Deny-by-default execute on SECURITY DEFINER functions.
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
  END LOOP;
END;
$$;

-- Ensure newly created functions are not executable by PUBLIC by default.
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

-- 2) Explicit RPC allowlist for anon.
DO $$
DECLARE
  fn_name text;
  grant_stmt text;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'get_public_site',
      'upsert_affiliate_signup',
      'get_account_by_invite_code'
    ])
  LOOP
    SELECT string_agg(
             format('GRANT EXECUTE ON FUNCTION %s TO anon', p.oid::regprocedure),
             '; '
           )
    INTO grant_stmt
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn_name;

    IF grant_stmt IS NOT NULL THEN
      EXECUTE grant_stmt;
    END IF;
  END LOOP;
END;
$$;

-- 3) Explicit RPC allowlist for authenticated.
DO $$
DECLARE
  fn_name text;
  grant_stmt text;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'get_public_site',
      'upsert_affiliate_signup',
      'get_account_by_invite_code',
      'get_next_invoice_number'
    ])
  LOOP
    SELECT string_agg(
             format('GRANT EXECUTE ON FUNCTION %s TO authenticated', p.oid::regprocedure),
             '; '
           )
    INTO grant_stmt
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn_name;

    IF grant_stmt IS NOT NULL THEN
      EXECUTE grant_stmt;
    END IF;
  END LOOP;
END;
$$;

-- 4) Re-grant authenticated execute on functions referenced by RLS policies.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT DISTINCT p.oid::regprocedure
    FROM pg_policy pol
    JOIN pg_depend d
      ON d.classid = 'pg_policy'::regclass
     AND d.objid = pol.oid
     AND d.refclassid = 'pg_proc'::regclass
    JOIN pg_proc p ON p.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END;
$$;

-- 5) Replace permissive candidates policy if table exists.
DO $$
DECLARE
  has_candidates boolean;
  has_account_id boolean;
  has_user_id boolean;
  has_account_members boolean;
BEGIN
  SELECT to_regclass('public.candidates') IS NOT NULL INTO has_candidates;

  IF has_candidates THEN
    EXECUTE 'ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage candidates" ON public.candidates';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view candidates" ON public.candidates';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can insert candidates" ON public.candidates';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete candidates" ON public.candidates';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'candidates'
        AND column_name = 'account_id'
    ) INTO has_account_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'candidates'
        AND column_name = 'user_id'
    ) INTO has_user_id;

    SELECT to_regclass('public.account_members') IS NOT NULL INTO has_account_members;

    IF has_account_id AND has_account_members THEN
      EXECUTE '
        CREATE POLICY "Authenticated users can view candidates"
        ON public.candidates
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.account_members am
            WHERE am.account_id = candidates.account_id
              AND am.user_id = auth.uid()
          )
        )';

      EXECUTE '
        CREATE POLICY "Authenticated users can insert candidates"
        ON public.candidates
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.account_members am
            WHERE am.account_id = candidates.account_id
              AND am.user_id = auth.uid()
          )
        )';

      EXECUTE '
        CREATE POLICY "Authenticated users can update candidates"
        ON public.candidates
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.account_members am
            WHERE am.account_id = candidates.account_id
              AND am.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.account_members am
            WHERE am.account_id = candidates.account_id
              AND am.user_id = auth.uid()
          )
        )';

      EXECUTE '
        CREATE POLICY "Authenticated users can delete candidates"
        ON public.candidates
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.account_members am
            WHERE am.account_id = candidates.account_id
              AND am.user_id = auth.uid()
          )
        )';
    ELSIF has_user_id THEN
      EXECUTE '
        CREATE POLICY "Authenticated users can view candidates"
        ON public.candidates
        FOR SELECT
        TO authenticated
        USING (candidates.user_id = auth.uid())';

      EXECUTE '
        CREATE POLICY "Authenticated users can insert candidates"
        ON public.candidates
        FOR INSERT
        TO authenticated
        WITH CHECK (candidates.user_id = auth.uid())';

      EXECUTE '
        CREATE POLICY "Authenticated users can update candidates"
        ON public.candidates
        FOR UPDATE
        TO authenticated
        USING (candidates.user_id = auth.uid())
        WITH CHECK (candidates.user_id = auth.uid())';

      EXECUTE '
        CREATE POLICY "Authenticated users can delete candidates"
        ON public.candidates
        FOR DELETE
        TO authenticated
        USING (candidates.user_id = auth.uid())';
    ELSE
      RAISE NOTICE 'public.candidates exists but expected columns were not found; skipping replacement policies.';
    END IF;
  END IF;
END;
$$;

-- 6) Lock search_path for flagged functions if present.
ALTER FUNCTION IF EXISTS public.normalize_hiring_roles_status() SET search_path = public;
ALTER FUNCTION IF EXISTS public.accounts_normalize_hiring_role_status_tg() SET search_path = public;

COMMIT;
