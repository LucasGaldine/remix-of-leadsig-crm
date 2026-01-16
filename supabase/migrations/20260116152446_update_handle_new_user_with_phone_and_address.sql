/*
  # Update handle_new_user to Save Phone and Company Fields
  
  ## Overview
  Updates the handle_new_user trigger function to save:
  - User phone number to profiles table
  - Company phone and address to accounts table during account creation
  
  ## Changes
  - Add phone field when creating profile
  - Add company_phone and company_address when creating new account
  
  ## Security
  - Function remains SECURITY DEFINER
  - Maintains existing logic for account creation vs joining
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
  
  -- Only create a new account if user is not joining an existing one
  IF v_target_account_id IS NULL THEN
    -- Get company information from metadata
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