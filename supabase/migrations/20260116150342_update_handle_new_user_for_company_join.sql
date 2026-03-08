/*
  # Update handle_new_user for Company Join
  
  ## Overview
  Updates the handle_new_user function to support both:
  - Creating a new company (existing behavior)
  - Joining an existing company via invite code (new behavior)
  
  ## Changes
  
  When a user signs up:
  - If they have target_account_id in metadata, skip creating a new account
  - Otherwise, create a new account with company_name from metadata
  
  ## Notes
  
  The account_members entry for joining users is created in the frontend
  signUp function, so we don't duplicate that here.
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
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email
  );
  
  -- Check if user is joining an existing account
  v_target_account_id := NEW.raw_user_meta_data ->> 'target_account_id';
  
  -- Only create a new account if user is not joining an existing one
  IF v_target_account_id IS NULL THEN
    -- Get company name from metadata or use default
    v_company_name := COALESCE(
      NEW.raw_user_meta_data ->> 'company_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      'My Company'
    );
    
    -- Create default account for new user
    INSERT INTO public.accounts (company_name, company_email)
    VALUES (v_company_name, NEW.email)
    RETURNING id INTO v_account_id;
    
    -- Add user as owner of their new account
    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_account_id, NEW.id, 'owner', true);
  END IF;
  
  RETURN NEW;
END;
$$;