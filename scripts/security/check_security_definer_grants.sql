-- Fails when non-allowlisted SECURITY DEFINER functions are executable by anon/authenticated.
DO $$
DECLARE
  violation_count integer;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM (
    SELECT
      p.proname,
      p.oid::regprocedure AS signature,
      r.rolname AS grantee
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated')
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
      AND NOT (
        r.rolname = 'anon'
        AND p.oid::regprocedure::text IN (
          'get_public_site(uuid)',
          'get_account_by_invite_code(text)',
          'upsert_affiliate_signup(text,text,text,text)'
        )
      )
  ) violations;

  IF violation_count > 0 THEN
    RAISE EXCEPTION 'SECURITY DEFINER grant audit failed: % violations found', violation_count;
  END IF;
END;
$$;
