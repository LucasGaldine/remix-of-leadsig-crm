/*
  # Fix function search paths and revoke unnecessary EXECUTE grants on SECURITY DEFINER functions

  1. Search Path Fixes
    - `set_elo_growth_signup_normalized_email`: add immutable search_path
    - `is_lead_fully_paid`: add immutable search_path

  2. Revoke EXECUTE from anon on trigger/internal-only functions
    - `enforce_website_lead_pending_approval` (trigger only)
    - `sync_account_entitlement_from_member` (trigger only)
    - `trigger_dispatch_change_order_declined_notifications` (trigger only)
    - `trigger_dispatch_change_order_request_email` (trigger only)
    - `trigger_dispatch_change_order_request_email_from_line_items` (trigger only)
    - `upsert_job_release_for_paid_job` (trigger only)

  3. Revoke EXECUTE from anon AND authenticated on trigger-only functions
    (triggers run as table owner, not via RPC)
    - `enforce_website_lead_pending_approval`
    - `sync_account_entitlement_from_member`
    - `trigger_dispatch_change_order_declined_notifications`
    - `trigger_dispatch_change_order_request_email`
    - `trigger_dispatch_change_order_request_email_from_line_items`
    - `upsert_job_release_for_paid_job`

  4. Revoke EXECUTE from authenticated on admin/server-only functions
    - `admin_mark_account_upgraded`
    - `list_all_accounts_for_admin`
    - `get_next_invoice_number`
    - `check_assignment_overlap`
    - `check_mock_assignment_overlap`

  5. RLS helper functions: keep authenticated access since they are used
     in RLS policy evaluation and by the app. Revoke anon where applicable.

  Note: `get_account_by_invite_code`, `get_public_site`, and `upsert_affiliate_signup`
  legitimately need anon access (public signup/site flows).
*/

-- 1. Fix mutable search_path on set_elo_growth_signup_normalized_email
CREATE OR REPLACE FUNCTION public.set_elo_growth_signup_normalized_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.normalized_email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$function$;

-- 1. Fix mutable search_path on is_lead_fully_paid
CREATE OR REPLACE FUNCTION public.is_lead_fully_paid(p_lead_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  WITH invoice_rollup AS (
    SELECT
      COUNT(*)::int AS invoice_count,
      COALESCE(bool_and(i.status = 'paid' AND COALESCE(i.balance_due, 0) <= 0), false) AS all_paid
    FROM public.invoices i
    WHERE i.lead_id = p_lead_id
  )
  SELECT (invoice_count > 0 AND all_paid)
  FROM invoice_rollup;
$function$;

-- 2 & 3. Revoke EXECUTE on trigger-only functions from anon and authenticated
-- These are only invoked by triggers (run as table owner), never via RPC
REVOKE EXECUTE ON FUNCTION public.enforce_website_lead_pending_approval() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_account_entitlement_from_member() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_declined_notifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_job_release_for_paid_job() FROM anon, authenticated;

-- 4. Revoke EXECUTE from authenticated on admin/server-only functions
-- These should only be called via service_role from edge functions
REVOKE EXECUTE ON FUNCTION public.admin_mark_account_upgraded(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_all_accounts_for_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) FROM authenticated;
