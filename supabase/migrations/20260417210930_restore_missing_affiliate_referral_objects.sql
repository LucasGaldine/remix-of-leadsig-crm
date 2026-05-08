/* Restore affiliate referral objects required by handle_new_user without replacing handle_new_user itself. */

CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  referral_code text NOT NULL UNIQUE,
  payout_percent numeric(5,4) NOT NULL DEFAULT 0.2 CHECK (payout_percent > 0 AND payout_percent <= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  referred_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  revenue_amount numeric(12,2) NOT NULL CHECK (revenue_amount >= 0),
  commission_rate numeric(5,4) NOT NULL CHECK (commission_rate > 0 AND commission_rate <= 1),
  commission_amount numeric(12,2) NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON public.affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referral_id ON public.affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred_account_id ON public.affiliate_commissions(referred_account_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view affiliate referrals for their account" ON public.affiliate_referrals;
CREATE POLICY "Account members can view affiliate referrals for their account"
  ON public.affiliate_referrals
  FOR SELECT
  TO authenticated
  USING (is_account_member(referred_account_id, auth.uid()));

DROP POLICY IF EXISTS "Account members can view affiliate commissions for their account" ON public.affiliate_commissions;
CREATE POLICY "Account members can view affiliate commissions for their account"
  ON public.affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (is_account_member(referred_account_id, auth.uid()));

DROP FUNCTION IF EXISTS public.generate_affiliate_referral_code();
CREATE FUNCTION public.generate_affiliate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := 'AFF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9));
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_affiliate_signup(
  p_full_name text,
  p_email text,
  p_base_url text DEFAULT NULL
)
RETURNS TABLE (
  affiliate_id uuid,
  referral_code text,
  referral_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_affiliate public.affiliates%ROWTYPE;
  v_referral_code text;
  v_base_url text;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF trim(COALESCE(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  v_base_url := COALESCE(NULLIF(trim(p_base_url), ''), 'https://app.leadsig.com');

  SELECT *
  INTO v_affiliate
  FROM public.affiliates
  WHERE email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    LOOP
      v_referral_code := public.generate_affiliate_referral_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.affiliates WHERE referral_code = v_referral_code
      );
    END LOOP;

    INSERT INTO public.affiliates (
      full_name,
      email,
      referral_code,
      status
    )
    VALUES (
      trim(p_full_name),
      v_email,
      v_referral_code,
      'active'
    )
    RETURNING * INTO v_affiliate;
  END IF;

  affiliate_id := v_affiliate.id;
  referral_code := v_affiliate.referral_code;
  referral_link := v_base_url || '/auth?ref=' || v_affiliate.referral_code;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_affiliate_signup(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_affiliate_referral_for_signup(
  p_account_id uuid,
  p_user_id uuid,
  p_referral_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_affiliate public.affiliates%ROWTYPE;
  v_code text;
BEGIN
  v_code := upper(trim(COALESCE(p_referral_code, '')));

  IF p_account_id IS NULL OR v_code = '' THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_affiliate
  FROM public.affiliates
  WHERE referral_code = v_code
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND lower(COALESCE(u.email, '')) = v_affiliate.email
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.affiliate_referrals (
    affiliate_id,
    referred_account_id,
    referred_user_id,
    referral_code
  )
  VALUES (
    v_affiliate.id,
    p_account_id,
    p_user_id,
    v_code
  )
  ON CONFLICT (referred_account_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_affiliate_commission_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_revenue numeric(12,2);
  v_rate numeric(5,4);
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status::text, '') <> 'completed' THEN
    RETURN NEW;
  END IF;

  v_revenue := ROUND(COALESCE(NEW.amount, 0)::numeric, 2);
  IF v_revenue <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT
    ar.id AS referral_id,
    ar.affiliate_id,
    COALESCE(a.payout_percent, 0.2)::numeric(5,4) AS commission_rate
  INTO v_referral
  FROM public.affiliate_referrals ar
  INNER JOIN public.affiliates a ON a.id = ar.affiliate_id
  WHERE ar.referred_account_id = NEW.account_id
    AND a.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_rate := v_referral.commission_rate;

  INSERT INTO public.affiliate_commissions (
    affiliate_id,
    referral_id,
    payment_id,
    referred_account_id,
    revenue_amount,
    commission_rate,
    commission_amount,
    status
  )
  VALUES (
    v_referral.affiliate_id,
    v_referral.referral_id,
    NEW.id,
    NEW.account_id,
    v_revenue,
    v_rate,
    ROUND(v_revenue * v_rate, 2),
    'pending'
  )
  ON CONFLICT (payment_id) DO UPDATE
  SET
    revenue_amount = EXCLUDED.revenue_amount,
    commission_rate = EXCLUDED.commission_rate,
    commission_amount = EXCLUDED.commission_amount,
    referred_account_id = EXCLUDED.referred_account_id,
    referral_id = EXCLUDED.referral_id,
    affiliate_id = EXCLUDED.affiliate_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_affiliate_commission_on_payment ON public.payments;
CREATE TRIGGER trg_create_affiliate_commission_on_payment
  AFTER INSERT OR UPDATE OF status, amount, account_id
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_affiliate_commission_from_payment();;
