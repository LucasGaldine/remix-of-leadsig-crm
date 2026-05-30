#!/usr/bin/env node

import { execSync } from "node:child_process";

const DEFAULT_EMAIL = "local-admin@leadsig.test";
const DEFAULT_PASSWORD = "LocalTest123!";
const DEFAULT_FULL_NAME = "Local Admin";
const DEFAULT_COMPANY_NAME = "Local Test Company";
const DEFAULT_ROLE = "owner";
const DEFAULT_CREW_EMAIL = "local-crew-1@leadsig.test";
const DEFAULT_CREW_PASSWORD = "LocalCrew123!";
const DEFAULT_CREW_FULL_NAME = "Local Crew Member 1";
const DEFAULT_CREW_ROLE = "crew_member";
const DEFAULT_PRICING_PLAN = "basic";
const DEFAULT_PRICING_TIER = "growth";
const DEFAULT_CONTACT_NAME = "Local Test Contact";
const DEFAULT_CONTACT_EMAIL = "contact@localtestco.test";
const DEFAULT_CONTACT_PHONE = "(555) 010-0001";
const DEFAULT_CONTACT_ADDRESS = "123 Local Test St";
const DEFAULT_CONTACT_CITY = "Austin";
const DB_CONTAINER = "supabase_db_knjbakdhjspftwqrzzcl";

function q(value) {
  return String(value).replace(/'/g, "''");
}

function runSql(sql) {
  const cmd = `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1`;
  execSync(cmd, { input: sql, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" });
}

function bootstrapUser({ email, password, fullName, companyName, crewEmail, crewPassword, crewFullName }) {
  const sql = `
DO $$
DECLARE
  v_email text := '${q(email)}';
  v_password text := '${q(password)}';
  v_full_name text := '${q(fullName)}';
  v_company text := '${q(companyName)}';
  v_role text := '${q(DEFAULT_ROLE)}';
  v_crew_email text := '${q(crewEmail)}';
  v_crew_password text := '${q(crewPassword)}';
  v_crew_full_name text := '${q(crewFullName)}';
  v_crew_role text := '${q(DEFAULT_CREW_ROLE)}';
  v_pricing_plan text := '${q(DEFAULT_PRICING_PLAN)}';
  v_pricing_tier text := '${q(DEFAULT_PRICING_TIER)}';
  v_contact_name text := '${q(DEFAULT_CONTACT_NAME)}';
  v_contact_email text := '${q(DEFAULT_CONTACT_EMAIL)}';
  v_contact_phone text := '${q(DEFAULT_CONTACT_PHONE)}';
  v_contact_address text := '${q(DEFAULT_CONTACT_ADDRESS)}';
  v_contact_city text := '${q(DEFAULT_CONTACT_CITY)}';
  v_user_id uuid;
  v_crew_user_id uuid;
  v_account_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', v_full_name, 'role', v_role, 'company_name', v_company),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_full_name)
    WHERE id = v_user_id;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email'
    );
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (v_user_id, v_full_name, v_email)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = excluded.full_name,
        email = excluded.email;

  SELECT account_id INTO v_account_id
  FROM public.account_members
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (company_name, company_email, pricing_plan, pricing_tier)
    VALUES (v_company, v_email, v_pricing_plan, v_pricing_tier)
    RETURNING id INTO v_account_id;
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.accounts
  SET company_name = v_company,
      company_email = v_email,
      pricing_plan = v_pricing_plan,
      pricing_tier = v_pricing_tier,
      updated_at = now()
  WHERE id = v_account_id;

  INSERT INTO public.account_members (account_id, user_id, role, is_active, inactive_reason)
  VALUES (v_account_id, v_user_id, v_role::public.app_role, true, null)
  ON CONFLICT (account_id, user_id) DO UPDATE
    SET role = excluded.role,
        is_active = true,
        inactive_reason = null,
        updated_at = now();

  SELECT id INTO v_crew_user_id FROM auth.users WHERE email = v_crew_email;

  IF v_crew_user_id IS NULL THEN
    v_crew_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_crew_user_id,
      'authenticated',
      'authenticated',
      v_crew_email,
      crypt(v_crew_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', v_crew_full_name, 'role', v_crew_role, 'company_name', v_company),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_crew_user_id,
      v_crew_email,
      jsonb_build_object('sub', v_crew_user_id::text, 'email', v_crew_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(v_crew_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('full_name', v_crew_full_name, 'role', v_crew_role, 'company_name', v_company)
    WHERE id = v_crew_user_id;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_crew_user_id,
      v_crew_email,
      jsonb_build_object('sub', v_crew_user_id::text, 'email', v_crew_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = v_crew_user_id AND provider = 'email'
    );
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (v_crew_user_id, v_crew_full_name, v_crew_email)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = excluded.full_name,
        email = excluded.email;

  INSERT INTO public.account_members (account_id, user_id, role, is_active, inactive_reason)
  VALUES (v_account_id, v_crew_user_id, v_crew_role::public.app_role, true, null)
  ON CONFLICT (account_id, user_id) DO UPDATE
    SET role = excluded.role,
        is_active = true,
        inactive_reason = null,
        updated_at = now();

  INSERT INTO public.customers (
    name,
    email,
    phone,
    address,
    city,
    account_id,
    created_by
  )
  SELECT
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_contact_address,
    v_contact_city,
    v_account_id,
    v_user_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.account_id = v_account_id
      AND lower(coalesce(c.email, '')) = lower(v_contact_email)
  );
END $$;
`;

  runSql(sql);
}

function main() {
  const email = process.env.LOCAL_DEV_EMAIL?.trim() || DEFAULT_EMAIL;
  const password = process.env.LOCAL_DEV_PASSWORD?.trim() || DEFAULT_PASSWORD;
  const fullName = process.env.LOCAL_DEV_FULL_NAME?.trim() || DEFAULT_FULL_NAME;
  const companyName = process.env.LOCAL_DEV_COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
  const crewEmail = process.env.LOCAL_DEV_CREW_EMAIL?.trim() || DEFAULT_CREW_EMAIL;
  const crewPassword = process.env.LOCAL_DEV_CREW_PASSWORD?.trim() || DEFAULT_CREW_PASSWORD;
  const crewFullName = process.env.LOCAL_DEV_CREW_FULL_NAME?.trim() || DEFAULT_CREW_FULL_NAME;

  if (password.length < 8) {
    throw new Error("LOCAL_DEV_PASSWORD must be at least 8 characters");
  }

  if (crewPassword.length < 8) {
    throw new Error("LOCAL_DEV_CREW_PASSWORD must be at least 8 characters");
  }

  bootstrapUser({ email, password, fullName, companyName, crewEmail, crewPassword, crewFullName });

  console.log("Local bootstrap user ready");
  console.log(`email=${email}`);
  console.log(`password=${password}`);
  console.log("Local crew member ready");
  console.log(`crew_email=${crewEmail}`);
  console.log(`crew_password=${crewPassword}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
