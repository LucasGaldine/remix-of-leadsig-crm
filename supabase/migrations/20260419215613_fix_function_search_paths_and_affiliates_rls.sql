/*
  # Fix function search paths and add affiliates RLS policies

  1. Security fixes
    - Set immutable `search_path` on `generate_affiliate_referral_code` to prevent search path manipulation
    - Set immutable `search_path` on `prevent_direct_billing_field_updates` to prevent search path manipulation
    - Add RLS policies on `affiliates` table so it is not locked out with no access

  2. New policies on `affiliates`
    - SELECT: service_role only (admin access via server)
    - INSERT: service_role only
    - UPDATE: service_role only
    - DELETE: service_role only

  Note: The affiliates table is an internal/admin table managed by server-side
  flows, so all policies restrict access to service_role.
*/

CREATE OR REPLACE FUNCTION public.generate_affiliate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  v_code text;
BEGIN
  v_code := 'AFF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));
  RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_direct_billing_field_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF jwt_role IS DISTINCT FROM 'service_role'
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'Service role can select affiliates'
  ) THEN
    CREATE POLICY "Service role can select affiliates"
      ON public.affiliates FOR SELECT
      TO service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'Service role can insert affiliates'
  ) THEN
    CREATE POLICY "Service role can insert affiliates"
      ON public.affiliates FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'Service role can update affiliates'
  ) THEN
    CREATE POLICY "Service role can update affiliates"
      ON public.affiliates FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliates' AND policyname = 'Service role can delete affiliates'
  ) THEN
    CREATE POLICY "Service role can delete affiliates"
      ON public.affiliates FOR DELETE
      TO service_role
      USING (true);
  END IF;
END $$;
