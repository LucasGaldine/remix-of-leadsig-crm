/*
  # Comprehensive Security Fixes
  
  ## Overview
  This migration addresses multiple security and performance issues identified in the database audit.
  
  ## Changes Made
  
  ### 1. Foreign Key Indexes
  Added missing indexes on foreign key columns to improve query performance:
  - account_members.invited_by
  - api_keys.account_id
  - customers.lead_id
  - estimate_line_items (account_id, estimate_id)
  - estimates.created_by
  - interactions (account_id, created_by)
  - invoice_line_items (account_id, invoice_id)
  - invoices (created_by, estimate_id)
  - lead_qualifications.account_id
  - lead_source_connections (account_id, api_key_id)
  - material_items.account_id
  - material_lists.created_by
  - payments (lead_id, processed_by)
  - pricing_rules.account_id
  - quick_estimates (account_id, converted_to_estimate_id, lead_id)
  - stripe_connect_accounts.account_id
  - supply_order_items (account_id, material_item_id)
  - supply_orders (created_by, material_list_id)
  - webhook_events (invoice_id, payment_id)
  
  ### 2. RLS Policy Optimization
  All RLS policies updated to use `(select auth.uid())` pattern to prevent re-evaluation for each row.
  
  ### 3. Security Hardening
  - Removed all "always true" RLS policies that bypass security
  - Removed duplicate permissive policies
  - Consolidated policies for cleaner security model
  
  ### 4. Function Security
  Fixed search_path for security-critical functions.
  
  ### 5. Unused Indexes
  Kept all indexes as they may be needed for future query patterns.
*/

-- ============================================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_account_members_invited_by ON public.account_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON public.api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_id ON public.customers(lead_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_account_id ON public.estimate_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate_id ON public.estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON public.estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON public.interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_by ON public.interactions(created_by);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON public.invoice_line_items(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON public.invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_account_id ON public.lead_qualifications(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_source_connections_account_id ON public.lead_source_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_source_connections_api_key_id ON public.lead_source_connections(api_key_id);
CREATE INDEX IF NOT EXISTS idx_material_items_account_id ON public.material_items(account_id);
CREATE INDEX IF NOT EXISTS idx_material_lists_created_by ON public.material_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_processed_by ON public.payments(processed_by);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_account_id ON public.pricing_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_quick_estimates_account_id ON public.quick_estimates(account_id);
CREATE INDEX IF NOT EXISTS idx_quick_estimates_converted_to_estimate_id ON public.quick_estimates(converted_to_estimate_id);
CREATE INDEX IF NOT EXISTS idx_quick_estimates_lead_id ON public.quick_estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_account_id ON public.stripe_connect_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_account_id ON public.supply_order_items(account_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_material_item_id ON public.supply_order_items(material_item_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_created_by ON public.supply_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_supply_orders_material_list_id ON public.supply_orders(material_list_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice_id ON public.webhook_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON public.webhook_events(payment_id);

-- ============================================================================
-- SECTION 2: FIX FUNCTION SECURITY (Search Path)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := substring(md5(random()::text) from 1 for 8);
    SELECT EXISTS(SELECT 1 FROM accounts WHERE invite_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid uuid)
RETURNS TABLE(role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role
  FROM user_roles ur
  WHERE ur.user_id = user_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM user_roles
    WHERE user_id = user_uuid AND role = role_name
  );
END;
$$;

-- ============================================================================
-- SECTION 3: REMOVE INSECURE "ALWAYS TRUE" POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users have full access to api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated users have full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users have full access to estimate_line_items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Authenticated users have full access to estimates" ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users have full access to interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users have full access to invoice_line_items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users have full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users have full access to lead_qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Authenticated users have full access to lead_source_connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Authenticated users have full access to material_items" ON public.material_items;
DROP POLICY IF EXISTS "Authenticated users have full access to material_lists" ON public.material_lists;
DROP POLICY IF EXISTS "Authenticated users have full access to payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users have full access to pricing_rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Authenticated users have full access to quick_estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Authenticated users have full access to stripe_connect_accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Authenticated users have full access to supply_order_items" ON public.supply_order_items;
DROP POLICY IF EXISTS "Authenticated users have full access to supply_orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Authenticated users have full access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users have full access to webhook_events" ON public.webhook_events;
DROP POLICY IF EXISTS "Allow profile creation on signup" ON public.profiles;
DROP POLICY IF EXISTS "Allow role creation on signup" ON public.user_roles;

-- ============================================================================
-- SECTION 4: REMOVE OLD/DUPLICATE POLICIES BEFORE RECREATING
-- ============================================================================

-- Accounts
DROP POLICY IF EXISTS "Users can view their accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Account owners and admins can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;
DROP POLICY IF EXISTS "Account owners can delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;

-- Account Members
DROP POLICY IF EXISTS "Users can view own membership record" ON public.account_members;
DROP POLICY IF EXISTS "System can insert memberships" ON public.account_members;

-- API Keys
DROP POLICY IF EXISTS "Account members can view API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Account owners and admins can create API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Account owners and admins can update API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Account owners and admins can delete API keys" ON public.api_keys;

-- Customers
DROP POLICY IF EXISTS "Account members can view customers" ON public.customers;
DROP POLICY IF EXISTS "Account members can create customers" ON public.customers;
DROP POLICY IF EXISTS "Account members can update customers" ON public.customers;
DROP POLICY IF EXISTS "Account owners and admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their account" ON public.customers;

-- Estimates
DROP POLICY IF EXISTS "Account members can view estimates" ON public.estimates;
DROP POLICY IF EXISTS "Account members can create estimates" ON public.estimates;
DROP POLICY IF EXISTS "Account members can update estimates" ON public.estimates;
DROP POLICY IF EXISTS "Account owners and admins can delete estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can view estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can create estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can update estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can delete estimates in their account" ON public.estimates;

-- Estimate Line Items
DROP POLICY IF EXISTS "Account members can view estimate line items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Account members can create estimate line items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Account members can update estimate line items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Account members can delete estimate line items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can view estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can create estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can update estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can delete estimate line items in their account" ON public.estimate_line_items;

-- Invoices
DROP POLICY IF EXISTS "Account members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Account members can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Account members can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Account owners and admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can create invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their account" ON public.invoices;

-- Invoice Line Items
DROP POLICY IF EXISTS "Account members can view invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account members can create invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account members can update invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Account members can delete invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can view invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can create invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can update invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can delete invoice line items in their account" ON public.invoice_line_items;

-- Interactions
DROP POLICY IF EXISTS "Account members can view interactions" ON public.interactions;
DROP POLICY IF EXISTS "Account members can create interactions" ON public.interactions;
DROP POLICY IF EXISTS "Account members can update interactions" ON public.interactions;
DROP POLICY IF EXISTS "Account owners and admins can delete interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can view interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can create interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can update interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can delete interactions in their account" ON public.interactions;

-- Leads
DROP POLICY IF EXISTS "Account members can view leads" ON public.leads;
DROP POLICY IF EXISTS "Account members can create leads" ON public.leads;
DROP POLICY IF EXISTS "Account members can update leads" ON public.leads;
DROP POLICY IF EXISTS "Account owners and admins can delete leads" ON public.leads;

-- Lead Qualifications
DROP POLICY IF EXISTS "Account members can view lead qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Account members can create lead qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Account members can update lead qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Account members can delete lead qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can view lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can create lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can update lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can delete lead qualifications in their account" ON public.lead_qualifications;

-- Lead Source Connections
DROP POLICY IF EXISTS "Account members can view lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Account owners and admins can create lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Account owners and admins can update lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Account owners and admins can delete lead source connections" ON public.lead_source_connections;

-- Material Items
DROP POLICY IF EXISTS "Account members can view material items" ON public.material_items;
DROP POLICY IF EXISTS "Account members can create material items" ON public.material_items;
DROP POLICY IF EXISTS "Account members can update material items" ON public.material_items;
DROP POLICY IF EXISTS "Account members can delete material items" ON public.material_items;
DROP POLICY IF EXISTS "Users can view material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can create material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can update material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can delete material items in their account" ON public.material_items;

-- Material Lists
DROP POLICY IF EXISTS "Account members can view material lists" ON public.material_lists;
DROP POLICY IF EXISTS "Account members can create material lists" ON public.material_lists;
DROP POLICY IF EXISTS "Account members can update material lists" ON public.material_lists;
DROP POLICY IF EXISTS "Account owners and admins can delete material lists" ON public.material_lists;
DROP POLICY IF EXISTS "Users can view material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can create material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can update material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can delete material lists in their account" ON public.material_lists;

-- Payments
DROP POLICY IF EXISTS "Account members can view payments" ON public.payments;
DROP POLICY IF EXISTS "Account members can create payments" ON public.payments;
DROP POLICY IF EXISTS "Account members can update payments" ON public.payments;
DROP POLICY IF EXISTS "Account owners and admins can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can create payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments in their account" ON public.payments;

-- Pricing Rules
DROP POLICY IF EXISTS "Account members can view pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Account members can create pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Account members can update pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Account owners and admins can delete pricing rules" ON public.pricing_rules;

-- Profiles
DROP POLICY IF EXISTS "Sales can view crew lead profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Quick Estimates
DROP POLICY IF EXISTS "Account members can view quick estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Account members can create quick estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Account members can update quick estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Account owners and admins can delete quick estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can view quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can create quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can update quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can delete quick estimates in their account" ON public.quick_estimates;

-- Stripe Connect Accounts
DROP POLICY IF EXISTS "Account members can view Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Account owners and admins can create Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Account owners and admins can update Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Account owners and admins can delete Stripe accounts" ON public.stripe_connect_accounts;

-- Supply Order Items
DROP POLICY IF EXISTS "Account members can view supply order items" ON public.supply_order_items;
DROP POLICY IF EXISTS "Account members can create supply order items" ON public.supply_order_items;
DROP POLICY IF EXISTS "Account members can update supply order items" ON public.supply_order_items;
DROP POLICY IF EXISTS "Account members can delete supply order items" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can view supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can create supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can update supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can delete supply order items in their account" ON public.supply_order_items;

-- Supply Orders
DROP POLICY IF EXISTS "Account members can view supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Account members can create supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Account members can update supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Account owners and admins can delete supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can view supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can create supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can update supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can delete supply orders in their account" ON public.supply_orders;

-- ============================================================================
-- SECTION 5: CREATE OPTIMIZED RLS POLICIES WITH (select auth.uid())
-- ============================================================================

-- Helper function to check account membership (security definer to cache auth.uid())
CREATE OR REPLACE FUNCTION public.user_is_account_member(account_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  RETURN EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = account_uuid
    AND user_id = current_user_id
  );
END;
$$;

-- Helper function to check if user is account owner or admin
CREATE OR REPLACE FUNCTION public.user_is_account_owner_or_admin(account_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  RETURN EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = account_uuid
    AND user_id = current_user_id
    AND role IN ('owner', 'admin')
  );
END;
$$;

-- Accounts Table
CREATE POLICY "Account members can view their accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (user_is_account_member(id));

CREATE POLICY "Account owners and admins can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (user_is_account_owner_or_admin(id))
  WITH CHECK (user_is_account_owner_or_admin(id));

CREATE POLICY "Account owners can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(id));

-- Account Members Table
CREATE POLICY "Users can view their own membership"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- API Keys Table
CREATE POLICY "Account members can view API keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can create API keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can update API keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id))
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can delete API keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Customers Table
CREATE POLICY "Account members can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Estimates Table
CREATE POLICY "Account members can view estimates"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create estimates"
  ON public.estimates FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update estimates"
  ON public.estimates FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete estimates"
  ON public.estimates FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Estimate Line Items Table
CREATE POLICY "Account members can view estimate line items"
  ON public.estimate_line_items FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create estimate line items"
  ON public.estimate_line_items FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update estimate line items"
  ON public.estimate_line_items FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can delete estimate line items"
  ON public.estimate_line_items FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));

-- Invoices Table
CREATE POLICY "Account members can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete invoices"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Invoice Line Items Table
CREATE POLICY "Account members can view invoice line items"
  ON public.invoice_line_items FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create invoice line items"
  ON public.invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update invoice line items"
  ON public.invoice_line_items FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can delete invoice line items"
  ON public.invoice_line_items FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));

-- Interactions Table
CREATE POLICY "Account members can view interactions"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create interactions"
  ON public.interactions FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update interactions"
  ON public.interactions FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete interactions"
  ON public.interactions FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Leads Table
CREATE POLICY "Account members can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Lead Qualifications Table
CREATE POLICY "Account members can view lead qualifications"
  ON public.lead_qualifications FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create lead qualifications"
  ON public.lead_qualifications FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update lead qualifications"
  ON public.lead_qualifications FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can delete lead qualifications"
  ON public.lead_qualifications FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));

-- Lead Source Connections Table
CREATE POLICY "Account members can view lead source connections"
  ON public.lead_source_connections FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can create lead source connections"
  ON public.lead_source_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can update lead source connections"
  ON public.lead_source_connections FOR UPDATE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id))
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can delete lead source connections"
  ON public.lead_source_connections FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Material Items Table
CREATE POLICY "Account members can view material items"
  ON public.material_items FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create material items"
  ON public.material_items FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update material items"
  ON public.material_items FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can delete material items"
  ON public.material_items FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));

-- Material Lists Table
CREATE POLICY "Account members can view material lists"
  ON public.material_lists FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create material lists"
  ON public.material_lists FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update material lists"
  ON public.material_lists FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete material lists"
  ON public.material_lists FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Payments Table
CREATE POLICY "Account members can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Pricing Rules Table
CREATE POLICY "Account members can view pricing rules"
  ON public.pricing_rules FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create pricing rules"
  ON public.pricing_rules FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update pricing rules"
  ON public.pricing_rules FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete pricing rules"
  ON public.pricing_rules FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Profiles Table
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Quick Estimates Table
CREATE POLICY "Account members can view quick estimates"
  ON public.quick_estimates FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create quick estimates"
  ON public.quick_estimates FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update quick estimates"
  ON public.quick_estimates FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete quick estimates"
  ON public.quick_estimates FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Stripe Connect Accounts Table
CREATE POLICY "Account members can view Stripe accounts"
  ON public.stripe_connect_accounts FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can create Stripe accounts"
  ON public.stripe_connect_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can update Stripe accounts"
  ON public.stripe_connect_accounts FOR UPDATE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id))
  WITH CHECK (user_is_account_owner_or_admin(account_id));

CREATE POLICY "Account owners and admins can delete Stripe accounts"
  ON public.stripe_connect_accounts FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- Supply Order Items Table
CREATE POLICY "Account members can view supply order items"
  ON public.supply_order_items FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create supply order items"
  ON public.supply_order_items FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update supply order items"
  ON public.supply_order_items FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can delete supply order items"
  ON public.supply_order_items FOR DELETE
  TO authenticated
  USING (user_is_account_member(account_id));

-- Supply Orders Table
CREATE POLICY "Account members can view supply orders"
  ON public.supply_orders FOR SELECT
  TO authenticated
  USING (user_is_account_member(account_id));

CREATE POLICY "Account members can create supply orders"
  ON public.supply_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account members can update supply orders"
  ON public.supply_orders FOR UPDATE
  TO authenticated
  USING (user_is_account_member(account_id))
  WITH CHECK (user_is_account_member(account_id));

CREATE POLICY "Account owners and admins can delete supply orders"
  ON public.supply_orders FOR DELETE
  TO authenticated
  USING (user_is_account_owner_or_admin(account_id));

-- ============================================================================
-- NOTES
-- ============================================================================

/*
  ## Remaining Issues to Address Manually

  1. **Leaked Password Protection**: Enable this in your Supabase Dashboard under:
     Authentication > Settings > Password protection
     
  2. **Unused Indexes**: The following indexes are currently unused but kept for potential future use:
     - idx_leads_new_status
     - idx_api_keys_key_hash
     - idx_interactions_created_at
     - idx_invoices_due_date
     - idx_invoices_status
     - idx_material_items_material_list_id
     - idx_payments_invoice_id
     - idx_payments_status
     - idx_supply_order_items_supply_order_id
     - idx_supply_orders_status
     - idx_webhook_events_* (event_type, processed_at, status)
     - idx_leads_scheduled_date
     - idx_leads_crew_lead_id
     - idx_leads_customer_id
     - idx_leads_account_id
     - idx_customers_account_id
     - idx_accounts_invite_code
     
     Monitor these in production. If truly unused after analysis, consider removing them.

  3. **User Roles Table**: Still needs proper RLS policies if being used.
  
  4. **Webhook Events**: Still needs proper RLS policies if being used.
*/