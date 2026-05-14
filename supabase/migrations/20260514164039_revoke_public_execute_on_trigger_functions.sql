/*
  # Revoke PUBLIC execute grant on trigger-only SECURITY DEFINER functions

  1. Problem
    - Trigger functions that return `trigger` type were granted EXECUTE to
      the PUBLIC pseudo-role by default when CREATE OR REPLACE FUNCTION ran.
    - Previous migration revoked from `anon` and `authenticated` directly,
      but access persisted through the PUBLIC pseudo-role inheritance.

  2. Fix
    - Revoke ALL on these functions from PUBLIC (the pseudo-role)
    - Explicitly re-grant only to service_role (needed for trigger execution context)
    - These functions are ONLY invoked by database triggers, never via RPC

  3. Functions affected
    - `enforce_website_lead_pending_approval()`
    - `sync_account_entitlement_from_member()`
    - `trigger_dispatch_change_order_declined_notifications()`
    - `trigger_dispatch_change_order_request_email()`
    - `trigger_dispatch_change_order_request_email_from_line_items()`
    - `upsert_job_release_for_paid_job()`
*/

-- Revoke from PUBLIC pseudo-role (this is what anon/authenticated inherit from)
REVOKE ALL ON FUNCTION public.enforce_website_lead_pending_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_account_entitlement_from_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_declined_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_request_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_job_release_for_paid_job() FROM PUBLIC;

-- Also revoke from anon and authenticated explicitly to be thorough
REVOKE ALL ON FUNCTION public.enforce_website_lead_pending_approval() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_account_entitlement_from_member() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_declined_notifications() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_request_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_job_release_for_paid_job() FROM anon, authenticated;

-- Re-grant to service_role only (triggers execute in owner context but service_role needs it)
GRANT EXECUTE ON FUNCTION public.enforce_website_lead_pending_approval() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_account_entitlement_from_member() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_dispatch_change_order_declined_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_dispatch_change_order_request_email_from_line_items() TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_job_release_for_paid_job() TO service_role;

-- Now handle RLS helper functions: revoke direct RPC access from authenticated
-- while keeping them usable inside RLS policy evaluation.
-- RLS policies evaluate with the function owner's privileges (SECURITY DEFINER),
-- but the caller must have EXECUTE privilege. Since RLS evaluation happens
-- in the context of the authenticated user, we MUST keep authenticated access.
-- However, we can remove the explicit anon grant if present.
REVOKE ALL ON FUNCTION public.is_account_admin(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_account_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_lead_in_account(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_mock_profile_in_account(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_schedule_in_account(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_user_account_manager(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_user_in_account(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_is_account_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_is_account_owner_or_admin(uuid) FROM anon;
