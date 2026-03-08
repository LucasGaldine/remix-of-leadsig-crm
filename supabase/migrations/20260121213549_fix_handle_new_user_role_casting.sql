/*
  # Fix handle_new_user Role Type Casting
  
  ## Overview
  Fixes the handle_new_user trigger function to properly cast the role
  to the app_role enum type when inserting into account_members.
  
  ## Problem
  The previous version was trying to cast the role as text, but the
  account_members.role column is of type app_role (enum), causing
  a type mismatch error.
  
  ## Changes
  - Cast v_role to app_role enum type instead of text
  
  ## Security
  - Function remains SECURITY DEFINER
  - Maintains existing logic for account creation
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
BEGIN
  -- Get phone from metadata
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  
  -- Create profile with phone
  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    v_phone
  );
  
  -- Check if user is joining an existing account
  v_target_account_id := NEW.raw_user_meta_data ->> 'target_account_id';
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'sales');
  
  IF v_target_account_id IS NOT NULL THEN
    -- User is joining an existing account
    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_target_account_id::uuid, NEW.id, v_role::app_role, true);
  ELSE
    -- Create new account for user
    v_company_name := COALESCE(
      NEW.raw_user_meta_data ->> 'company_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      'My Company'
    );
    
    v_company_phone := NEW.raw_user_meta_data ->> 'company_phone';
    v_company_address := NEW.raw_user_meta_data ->> 'company_address';
    
    -- Create default account for new user with company details
    INSERT INTO public.accounts (company_name, company_email, company_phone, company_address)
    VALUES (v_company_name, NEW.email, v_company_phone, v_company_address)
    RETURNING id INTO v_account_id;
    
    -- Add user as owner of their new account
    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_account_id, NEW.id, 'owner', true);
  END IF;
  
  RETURN NEW;
END;
$$;