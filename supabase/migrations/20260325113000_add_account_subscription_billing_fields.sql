ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS pricing_tier text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS premium_setup_fee_paid boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_pricing_tier_check'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_pricing_tier_check
      CHECK (pricing_tier IS NULL OR pricing_tier IN ('solo', 'team', 'growth'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id
  ON public.accounts (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_stripe_subscription_id
  ON public.accounts (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_direct_billing_field_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS prevent_direct_billing_field_updates_trigger ON public.accounts;
CREATE TRIGGER prevent_direct_billing_field_updates_trigger
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_billing_field_updates();
