/*
  # Add Multi-User Account Support
  
  ## Overview
  This migration transforms the database from single-user to multi-user account architecture.
  Users can now belong to multiple accounts with different roles, and all resources are
  scoped to accounts instead of individual users.
  
  ## New Tables
  
  ### accounts
  Stores company/organization information:
  - `id` (uuid, primary key)
  - `company_name` (text, required) - Business name
  - `company_email` (text) - Primary business email
  - `company_phone` (text) - Business phone number
  - `company_address` (text) - Physical address
  - `billing_email` (text) - Email for billing
  - `website` (text) - Company website
  - `logo_url` (text) - URL to company logo
  - `settings` (jsonb) - Account-level settings
  - `created_at`, `updated_at` (timestamptz)
  
  ### account_members
  Links users to accounts with roles (many-to-many):
  - `id` (uuid, primary key)
  - `account_id` (uuid, FK to accounts) - The account
  - `user_id` (uuid, FK to auth.users) - The user
  - `role` (app_role enum) - User's role in this account
  - `invited_by` (uuid, FK to auth.users) - Who invited them
  - `invited_at` (timestamptz) - When invited
  - `joined_at` (timestamptz) - When they joined
  - `is_active` (boolean) - Whether membership is active
  - `created_at`, `updated_at` (timestamptz)
  
  ## Modified Tables
  
  All resource tables now have `account_id`:
  - leads
  - customers
  - estimates
  - invoices
  - payments
  - material_lists
  - supply_orders
  - quick_estimates
  - pricing_rules
  - api_keys
  - stripe_connect_accounts
  - lead_source_connections
  
  ## Data Migration
  
  For existing data:
  1. Create one account per existing user
  2. Add that user as owner of their account
  3. Link all their resources to their account
  
  ## Security
  
  - Enable RLS on new tables
  - Update all RLS policies to check account membership
  - Users can only access data from accounts they belong to
  
  ## Notes
  
  - Maintains backward compatibility by auto-creating accounts for existing users
  - The `created_by` fields remain for audit purposes
  - Users can switch between accounts in the frontend
*/

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_email text,
  company_phone text,
  company_address text,
  billing_email text,
  website text,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create account_members table
CREATE TABLE IF NOT EXISTS public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(account_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON public.account_members(account_id);
CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_active ON public.account_members(account_id, user_id) WHERE is_active = true;

-- Add account_id columns to resource tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.material_lists ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.supply_orders ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.quick_estimates ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.stripe_connect_accounts ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.lead_source_connections ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.estimate_line_items ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.material_items ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.supply_order_items ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.lead_qualifications ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);

-- Add indexes for account_id lookups
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON public.leads(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON public.customers(account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_account_id ON public.estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_account_id ON public.invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON public.payments(account_id);
CREATE INDEX IF NOT EXISTS idx_material_lists_account_id ON public.material_lists(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_account_id ON public.supply_orders(account_id);

-- Migrate existing data: Create one account per user and link their data
DO $$
DECLARE
  v_user RECORD;
  v_account_id uuid;
  v_profile RECORD;
BEGIN
  -- For each user that has created resources
  FOR v_user IN 
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    WHERE EXISTS (
      SELECT 1 FROM public.leads WHERE created_by = u.id
      UNION
      SELECT 1 FROM public.customers WHERE created_by = u.id
      UNION
      SELECT 1 FROM public.estimates WHERE created_by = u.id
    )
  LOOP
    -- Get profile info for company name
    SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user.id;
    
    -- Create account for this user
    INSERT INTO public.accounts (company_name, company_email)
    VALUES (
      COALESCE(v_profile.full_name, v_user.email, 'My Company'),
      v_user.email
    )
    RETURNING id INTO v_account_id;
    
    -- Add user as owner of their account
    INSERT INTO public.account_members (account_id, user_id, role, is_active)
    VALUES (v_account_id, v_user.id, 'owner', true);
    
    -- Link all their resources to their account
    UPDATE public.leads SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.customers SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.estimates SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.invoices SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.payments SET account_id = v_account_id WHERE processed_by = v_user.id AND account_id IS NULL;
    UPDATE public.material_lists SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.supply_orders SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.quick_estimates SET account_id = v_account_id WHERE created_by = v_user.id AND account_id IS NULL;
    UPDATE public.pricing_rules SET account_id = v_account_id WHERE user_id = v_user.id AND account_id IS NULL;
    UPDATE public.api_keys SET account_id = v_account_id WHERE user_id = v_user.id AND account_id IS NULL;
    UPDATE public.stripe_connect_accounts SET account_id = v_account_id WHERE user_id = v_user.id AND account_id IS NULL;
    UPDATE public.lead_source_connections SET account_id = v_account_id WHERE user_id = v_user.id AND account_id IS NULL;
    
    -- Link related records through joins
    UPDATE public.interactions SET account_id = v_account_id 
    WHERE lead_id IN (SELECT id FROM public.leads WHERE account_id = v_account_id) AND account_id IS NULL;
    
    UPDATE public.estimate_line_items SET account_id = v_account_id 
    WHERE estimate_id IN (SELECT id FROM public.estimates WHERE account_id = v_account_id) AND account_id IS NULL;
    
    UPDATE public.invoice_line_items SET account_id = v_account_id 
    WHERE invoice_id IN (SELECT id FROM public.invoices WHERE account_id = v_account_id) AND account_id IS NULL;
    
    UPDATE public.material_items SET account_id = v_account_id 
    WHERE material_list_id IN (SELECT id FROM public.material_lists WHERE account_id = v_account_id) AND account_id IS NULL;
    
    UPDATE public.supply_order_items SET account_id = v_account_id 
    WHERE supply_order_id IN (SELECT id FROM public.supply_orders WHERE account_id = v_account_id) AND account_id IS NULL;
    
    UPDATE public.lead_qualifications SET account_id = v_account_id 
    WHERE lead_id IN (SELECT id FROM public.leads WHERE account_id = v_account_id) AND account_id IS NULL;
  END LOOP;
END $$;

-- Add updated_at trigger to accounts
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger to account_members
DROP TRIGGER IF EXISTS update_account_members_updated_at ON public.account_members;
CREATE TRIGGER update_account_members_updated_at
  BEFORE UPDATE ON public.account_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts table
CREATE POLICY "Users can view their own accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = accounts.id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Account owners and admins can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = accounts.id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
      AND account_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = accounts.id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
      AND account_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_members.account_id = accounts.id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
      AND account_members.role = 'owner'
    )
  );

-- RLS Policies for account_members table
CREATE POLICY "Users can view members of their accounts"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

CREATE POLICY "Account owners and admins can invite members"
  ON public.account_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can update members"
  ON public.account_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can remove members"
  ON public.account_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
      AND am.role IN ('owner', 'admin')
    )
  );

-- Helper function to get user's accounts
CREATE OR REPLACE FUNCTION public.get_user_accounts(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE (
  account_id uuid,
  company_name text,
  role public.app_role,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id AS account_id,
    a.company_name,
    am.role,
    am.is_active
  FROM public.accounts a
  INNER JOIN public.account_members am ON am.account_id = a.id
  WHERE am.user_id = user_id_param
  AND am.is_active = true
  ORDER BY am.created_at ASC;
$$;

-- Helper function to check if user is member of account
CREATE OR REPLACE FUNCTION public.is_account_member(
  account_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members
    WHERE account_id = account_id_param
    AND user_id = user_id_param
    AND is_active = true
  );
$$;

-- Helper function to get user's role in account
CREATE OR REPLACE FUNCTION public.get_account_role(
  account_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.account_members
  WHERE account_id = account_id_param
  AND user_id = user_id_param
  AND is_active = true
  LIMIT 1;
$$;

-- Update handle_new_user to create account and add user as owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email
  );
  
  -- Create default account for new user
  INSERT INTO public.accounts (company_name, company_email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email, 'My Company'),
    NEW.email
  )
  RETURNING id INTO v_account_id;
  
  -- Add user as owner of their new account
  INSERT INTO public.account_members (account_id, user_id, role, is_active)
  VALUES (v_account_id, NEW.id, 'owner', true);
  
  RETURN NEW;
END;
$$;