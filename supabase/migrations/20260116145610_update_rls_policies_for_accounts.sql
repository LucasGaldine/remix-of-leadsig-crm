/*
  # Update RLS Policies for Account-Based Access

  ## Overview
  Updates all RLS policies to use account-based access control instead of user-based.
  Users can access resources that belong to accounts they are members of.
  
  ## Changes
  
  Drops and recreates RLS policies for:
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
  - interactions
  - estimate_line_items
  - invoice_line_items
  - material_items
  - supply_order_items
  - lead_qualifications
  
  ## Security Model
  
  - SELECT: All account members can view
  - INSERT: All account members can create
  - UPDATE: All account members can update
  - DELETE: Only owners and admins can delete
  
  Some tables like invoices and estimates may have stricter policies based on role.
*/

-- Drop existing policies for leads
DROP POLICY IF EXISTS "Users can view leads they created" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads they created" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads they created" ON public.leads;
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;

-- Create account-based policies for leads
CREATE POLICY "Account members can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Drop existing policies for customers
DROP POLICY IF EXISTS "Users can view customers they created" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers they created" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers they created" ON public.customers;

-- Create account-based policies for customers
CREATE POLICY "Account members can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Drop existing policies for estimates
DROP POLICY IF EXISTS "Users can view estimates they created" ON public.estimates;
DROP POLICY IF EXISTS "Users can insert estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can update estimates they created" ON public.estimates;
DROP POLICY IF EXISTS "Users can delete estimates they created" ON public.estimates;

-- Create account-based policies for estimates
CREATE POLICY "Account members can view estimates"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create estimates"
  ON public.estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update estimates"
  ON public.estimates FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete estimates"
  ON public.estimates FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Drop existing policies for invoices
DROP POLICY IF EXISTS "Users can view invoices they created" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices they created" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices they created" ON public.invoices;

-- Create account-based policies for invoices
CREATE POLICY "Account members can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete invoices"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Drop existing policies for payments
DROP POLICY IF EXISTS "Users can view payments they processed" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments they processed" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments they processed" ON public.payments;

-- Create account-based policies for payments
CREATE POLICY "Account members can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Material lists policies
DROP POLICY IF EXISTS "Users can view material lists they created" ON public.material_lists;
DROP POLICY IF EXISTS "Users can insert material lists" ON public.material_lists;
DROP POLICY IF EXISTS "Users can update material lists they created" ON public.material_lists;
DROP POLICY IF EXISTS "Users can delete material lists they created" ON public.material_lists;

CREATE POLICY "Account members can view material lists"
  ON public.material_lists FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create material lists"
  ON public.material_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update material lists"
  ON public.material_lists FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete material lists"
  ON public.material_lists FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Supply orders policies
DROP POLICY IF EXISTS "Users can view supply orders they created" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can insert supply orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can update supply orders they created" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can delete supply orders they created" ON public.supply_orders;

CREATE POLICY "Account members can view supply orders"
  ON public.supply_orders FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create supply orders"
  ON public.supply_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update supply orders"
  ON public.supply_orders FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete supply orders"
  ON public.supply_orders FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Quick estimates policies
DROP POLICY IF EXISTS "Users can view quick estimates they created" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can insert quick estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can update quick estimates they created" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can delete quick estimates they created" ON public.quick_estimates;

CREATE POLICY "Account members can view quick estimates"
  ON public.quick_estimates FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create quick estimates"
  ON public.quick_estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update quick estimates"
  ON public.quick_estimates FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete quick estimates"
  ON public.quick_estimates FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Pricing rules policies
DROP POLICY IF EXISTS "Users can view their pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can insert their pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can update their pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can delete their pricing rules" ON public.pricing_rules;

CREATE POLICY "Account members can view pricing rules"
  ON public.pricing_rules FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create pricing rules"
  ON public.pricing_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update pricing rules"
  ON public.pricing_rules FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete pricing rules"
  ON public.pricing_rules FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- API keys policies
DROP POLICY IF EXISTS "Users can view their API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert their API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their API keys" ON public.api_keys;

CREATE POLICY "Account members can view API keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can create API keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can update API keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can delete API keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Stripe connect accounts policies
DROP POLICY IF EXISTS "Users can view their Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Users can insert their Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Users can update their Stripe accounts" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Users can delete their Stripe accounts" ON public.stripe_connect_accounts;

CREATE POLICY "Account members can view Stripe accounts"
  ON public.stripe_connect_accounts FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can create Stripe accounts"
  ON public.stripe_connect_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can update Stripe accounts"
  ON public.stripe_connect_accounts FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can delete Stripe accounts"
  ON public.stripe_connect_accounts FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Lead source connections policies
DROP POLICY IF EXISTS "Users can view their lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can insert their lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can update their lead source connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can delete their lead source connections" ON public.lead_source_connections;

CREATE POLICY "Account members can view lead source connections"
  ON public.lead_source_connections FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can create lead source connections"
  ON public.lead_source_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can update lead source connections"
  ON public.lead_source_connections FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Account owners and admins can delete lead source connections"
  ON public.lead_source_connections FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Interactions policies
DROP POLICY IF EXISTS "Users can view interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can insert interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can update interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can delete interactions" ON public.interactions;

CREATE POLICY "Account members can view interactions"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create interactions"
  ON public.interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update interactions"
  ON public.interactions FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account owners and admins can delete interactions"
  ON public.interactions FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- Line item policies (these follow their parent's account)
CREATE POLICY "Account members can view estimate line items"
  ON public.estimate_line_items FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create estimate line items"
  ON public.estimate_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update estimate line items"
  ON public.estimate_line_items FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete estimate line items"
  ON public.estimate_line_items FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can view invoice line items"
  ON public.invoice_line_items FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create invoice line items"
  ON public.invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update invoice line items"
  ON public.invoice_line_items FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete invoice line items"
  ON public.invoice_line_items FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can view material items"
  ON public.material_items FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create material items"
  ON public.material_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update material items"
  ON public.material_items FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete material items"
  ON public.material_items FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can view supply order items"
  ON public.supply_order_items FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create supply order items"
  ON public.supply_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update supply order items"
  ON public.supply_order_items FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete supply order items"
  ON public.supply_order_items FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can view lead qualifications"
  ON public.lead_qualifications FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can create lead qualifications"
  ON public.lead_qualifications FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can update lead qualifications"
  ON public.lead_qualifications FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Account members can delete lead qualifications"
  ON public.lead_qualifications FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );