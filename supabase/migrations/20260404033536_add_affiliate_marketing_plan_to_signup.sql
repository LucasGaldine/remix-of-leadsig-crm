/*
  # Capture affiliate marketing plan at signup

  ## What this adds
  - `affiliates.marketing_plan`: stores how each affiliate plans to promote their referral link
  - `upsert_affiliate_signup(...)` update to require and persist `p_marketing_plan`
*/

ALTER TABLE public.affiliates
ADD COLUMN IF NOT EXISTS marketing_plan text;

DROP FUNCTION IF EXISTS public.upsert_affiliate_signup(text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_affiliate_signup(
  p_full_name text,
  p_email text,
  p_marketing_plan text,
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
  v_marketing_plan text;
  v_affiliate public.affiliates%ROWTYPE;
  v_referral_code text;
  v_base_url text;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));
  v_marketing_plan := trim(COALESCE(p_marketing_plan, ''));

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF trim(COALESCE(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF char_length(v_marketing_plan) < 10 THEN
    RAISE EXCEPTION 'Marketing plan must be at least 10 characters';
  END IF;

  v_base_url := COALESCE(NULLIF(trim(p_base_url), ''), 'https://app.leadsig.com');

  SELECT *
  INTO v_affiliate
  FROM public.affiliates
  WHERE email = v_email
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.affiliates
    SET
      full_name = trim(p_full_name),
      marketing_plan = v_marketing_plan,
      status = 'active',
      updated_at = now()
    WHERE id = v_affiliate.id
    RETURNING * INTO v_affiliate;
  ELSE
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
      marketing_plan,
      payout_percent,
      status
    )
    VALUES (
      trim(p_full_name),
      v_email,
      v_referral_code,
      v_marketing_plan,
      0.2,
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

GRANT EXECUTE ON FUNCTION public.upsert_affiliate_signup(text, text, text, text) TO anon, authenticated;
