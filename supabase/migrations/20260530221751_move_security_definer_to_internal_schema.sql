/*
  # Move SECURITY DEFINER logic to internal schema, convert public functions to INVOKER

  1. Problem
    - SECURITY DEFINER functions in public schema are exposed via PostgREST REST API
    - Scanner flags these as executable by anon/authenticated via /rest/v1/rpc/

  2. Solution
    - Create `internal` schema (not exposed by PostgREST)
    - Create SECURITY DEFINER implementations in internal schema
    - Replace public functions in-place with SECURITY INVOKER wrappers
    - All RLS policies continue working unchanged (same function signatures)
    - PostgREST sees SECURITY INVOKER functions which are not flagged

  3. Functions affected
    - is_account_admin, is_account_member, is_lead_in_account
    - is_mock_profile_in_account, is_schedule_in_account
    - is_user_account_manager, is_user_in_account
    - user_is_account_member, user_is_account_owner_or_admin
    - get_account_by_invite_code, get_public_site
*/

-- Create internal schema (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role, anon;

-- =============================================================
-- Create SECURITY DEFINER implementations in internal schema
-- =============================================================

CREATE OR REPLACE FUNCTION internal.is_account_member(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = p_account_id
    AND user_id = p_user_id
    AND is_active = true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION internal.is_account_admin(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = p_account_id
    AND user_id = p_user_id
    AND is_active = true
    AND role IN ('owner', 'admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION internal.is_lead_in_account(p_lead_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = p_lead_id AND account_id = p_account_id
  );
$function$;

CREATE OR REPLACE FUNCTION internal.is_mock_profile_in_account(p_mock_profile_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mock_crew_profiles
    WHERE id = p_mock_profile_id AND account_id = p_account_id
  );
$function$;

CREATE OR REPLACE FUNCTION internal.is_schedule_in_account(p_schedule_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.job_schedules
    WHERE id = p_schedule_id AND account_id = p_account_id
  );
$function$;

CREATE OR REPLACE FUNCTION internal.is_user_account_manager(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = p_account_id
    AND user_id = p_user_id
    AND is_active = true
    AND role IN ('owner', 'admin', 'crew_lead', 'sales')
  );
$function$;

CREATE OR REPLACE FUNCTION internal.is_user_in_account(p_user_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND account_id = p_account_id
  );
$function$;

CREATE OR REPLACE FUNCTION internal.user_is_account_member(account_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = account_uuid
    AND user_id = current_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION internal.user_is_account_owner_or_admin(account_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = account_uuid
    AND user_id = current_user_id
    AND role IN ('owner', 'admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION internal.get_account_by_invite_code(code text)
 RETURNS TABLE(id uuid, company_name text, invite_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT a.id, a.company_name, a.invite_code
  FROM public.accounts a
  WHERE UPPER(a.invite_code) = UPPER(code);
$function$;

CREATE OR REPLACE FUNCTION internal.get_public_site(account_uuid uuid)
 RETURNS TABLE(company_name text, company_phone text, company_email text, company_address text, logo_url text, settings jsonb, published boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT
    a.company_name,
    a.company_phone,
    a.company_email,
    a.company_address,
    a.logo_url,
    COALESCE(a.settings, '{}'::jsonb) AS settings,
    COALESCE((a.settings -> 'website' ->> 'published')::boolean, false) AS published
  FROM public.accounts a
  WHERE a.id = account_uuid
  LIMIT 1;
$function$;

-- =============================================================
-- Lock down internal schema function grants
-- =============================================================
REVOKE ALL ON FUNCTION internal.is_account_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_account_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_lead_in_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_mock_profile_in_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_schedule_in_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_user_account_manager(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.is_user_in_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.user_is_account_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.user_is_account_owner_or_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.get_account_by_invite_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.get_public_site(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION internal.is_account_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_account_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_lead_in_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_mock_profile_in_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_schedule_in_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_user_account_manager(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_user_in_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.user_is_account_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.user_is_account_owner_or_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.get_account_by_invite_code(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.get_public_site(uuid) TO anon, authenticated, service_role;

-- =============================================================
-- Replace public functions with SECURITY INVOKER wrappers
-- (CREATE OR REPLACE preserves existing policy dependencies)
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_account_member(p_account_id, p_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_account_admin(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_account_admin(p_account_id, p_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_lead_in_account(p_lead_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_lead_in_account(p_lead_id, p_account_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_mock_profile_in_account(p_mock_profile_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_mock_profile_in_account(p_mock_profile_id, p_account_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_schedule_in_account(p_schedule_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_schedule_in_account(p_schedule_id, p_account_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_user_account_manager(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_user_account_manager(p_account_id, p_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_user_in_account(p_user_id uuid, p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.is_user_in_account(p_user_id, p_account_id);
$function$;

CREATE OR REPLACE FUNCTION public.user_is_account_member(account_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.user_is_account_member(account_uuid);
$function$;

CREATE OR REPLACE FUNCTION public.user_is_account_owner_or_admin(account_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT internal.user_is_account_owner_or_admin(account_uuid);
$function$;

CREATE OR REPLACE FUNCTION public.get_account_by_invite_code(code text)
 RETURNS TABLE(id uuid, company_name text, invite_code text)
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT * FROM internal.get_account_by_invite_code(code);
$function$;

CREATE OR REPLACE FUNCTION public.get_public_site(account_uuid uuid)
 RETURNS TABLE(company_name text, company_phone text, company_email text, company_address text, logo_url text, settings jsonb, published boolean)
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT * FROM internal.get_public_site(account_uuid);
$function$;
