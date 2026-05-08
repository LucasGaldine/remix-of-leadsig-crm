/*
  Apply plan/tier overrides passed through auth user metadata during signup.
  Used for Elo + GoHighLevel paid-community routing into Essentials Growth.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
  v_target_account_id text;
  v_company_name text;
  v_company_phone text;
  v_company_address text;
  v_phone text;
  v_role text;
  v_affiliate_referral_code text;
  v_sms_consent_status text;
  v_sms_consent_captured_at timestamptz;
  v_sms_consent_source text;
  v_sms_consent_text_version text;
  v_initial_pricing_plan text;
  v_initial_pricing_tier text;
BEGIN
  -- Get signup metadata
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_sms_consent_status := COALESCE(NEW.raw_user_meta_data ->> 'sms_consent_status', 'unknown');
  v_sms_consent_captured_at := NULLIF(NEW.raw_user_meta_data ->> 'sms_consent_captured_at', '')::timestamptz;
  v_sms_consent_source := NEW.raw_user_meta_data ->> 'sms_consent_source';
  v_sms_consent_text_version := NEW.raw_user_meta_data ->> 'sms_consent_text_version';

  -- Create profile
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    sms_consent_status,
    sms_consent_captured_at,
    sms_consent_source,
    sms_consent_text_version
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    v_phone,
    CASE
      WHEN v_sms_consent_status IN ('opted_in', 'opted_out') THEN v_sms_consent_status
      ELSE 'unknown'
    END,
    v_sms_consent_captured_at,
    v_sms_consent_source,
    v_sms_consent_text_version
  );

  -- Existing account linking flow
  v_target_account_id := NEW.raw_user_meta_data ->> 'target_account_id';
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'sales');
  v_affiliate_referral_code := NEW.raw_user_meta_data ->> 'affiliate_referral_code';

  -- Optional account plan override metadata for newly created accounts only
  v_initial_pricing_plan := NEW.raw_user_meta_data ->> 'initial_pricing_plan';
  v_initial_pricing_tier := NEW.raw_user_meta_data ->> 'initial_pricing_tier';

  IF v_target_account_id IS NOT NULL THEN
    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_target_account_id::uuid, NEW.id, v_role::app_role, true);
  ELSE
    v_company_name := COALESCE(
      NEW.raw_user_meta_data ->> 'company_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      'My Company'
    );

    v_company_phone := NEW.raw_user_meta_data ->> 'company_phone';
    v_company_address := NEW.raw_user_meta_data ->> 'company_address';

    INSERT INTO public.accounts (
      company_name,
      company_email,
      company_phone,
      company_address,
      pricing_plan,
      pricing_tier
    )
    VALUES (
      v_company_name,
      NEW.email,
      v_company_phone,
      v_company_address,
      CASE
        WHEN v_initial_pricing_plan IN ('free', 'basic', 'premium') THEN v_initial_pricing_plan
        ELSE 'free'
      END,
      CASE
        WHEN v_initial_pricing_plan = 'basic' AND v_initial_pricing_tier IN ('solo', 'team', 'growth')
          THEN v_initial_pricing_tier
        ELSE NULL
      END
    )
    RETURNING id INTO v_account_id;

    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_account_id, NEW.id, 'owner', true);

    PERFORM public.link_affiliate_referral_for_signup(v_account_id, NEW.id, v_affiliate_referral_code);
  END IF;

  RETURN NEW;
END;
$$;;
