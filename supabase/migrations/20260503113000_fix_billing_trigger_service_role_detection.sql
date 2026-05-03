-- Ensure billing-field guard allows legitimate server billing updates.
-- Some server-key request paths may not populate request.jwt.claim.role.
-- Fall back to request.jwt.claims and current_user for service role detection.

CREATE OR REPLACE FUNCTION public.prevent_direct_billing_field_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
  jwt_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  claims_role text := lower(coalesce(jwt_claims ->> 'role', ''));
  db_role text := lower(current_user);
  is_server_context boolean := (
    lower(coalesce(jwt_role, '')) = 'service_role'
    OR claims_role = 'service_role'
    OR db_role = 'service_role'
  );
BEGIN
  IF NOT is_server_context
     AND (
       NEW.pricing_plan IS DISTINCT FROM OLD.pricing_plan
       OR NEW.pricing_tier IS DISTINCT FROM OLD.pricing_tier
       OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
       OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
       OR NEW.stripe_subscription_status IS DISTINCT FROM OLD.stripe_subscription_status
       OR NEW.premium_setup_fee_paid IS DISTINCT FROM OLD.premium_setup_fee_paid
     ) THEN
    RAISE EXCEPTION 'Billing fields can only be changed by server billing flows';
  END IF;

  RETURN NEW;
END;
$function$;
