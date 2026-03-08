/*
  # Update Existing Table Policies to Use Security Definer Functions
  
  ## Overview
  Replace all RLS policies that query account_members directly with calls
  to the new security definer functions. This eliminates circular dependencies.
  
  ## Changes
  
  ### Tables Updated
  - leads
  - customers
  - estimates
  - invoices
  - payments
  - material_lists
  - supply_orders
  - estimate_line_items
  - invoice_line_items
  - material_items
  - supply_order_items
  - interactions
  - lead_qualifications
  - quick_estimates
  
  ### Pattern
  OLD: WHERE EXISTS (SELECT 1 FROM account_members WHERE ...)
  NEW: WHERE get_user_account_id(auth.uid()) IS NOT NULL
  
  ## Security
  - All policies now use security definer functions that safely bypass RLS
  - Users can only access data for their account
  - No circular dependencies
*/

-- ============================================================================
-- LEADS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their account" ON public.leads;

CREATE POLICY "Users can view leads in their account"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create leads in their account"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update leads in their account"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete leads in their account"
  ON public.leads FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their account" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their account" ON public.customers;

CREATE POLICY "Users can view customers in their account"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create customers in their account"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update customers in their account"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete customers in their account"
  ON public.customers FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- ESTIMATES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can create estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can update estimates in their account" ON public.estimates;
DROP POLICY IF EXISTS "Users can delete estimates in their account" ON public.estimates;

CREATE POLICY "Users can view estimates in their account"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create estimates in their account"
  ON public.estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update estimates in their account"
  ON public.estimates FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete estimates in their account"
  ON public.estimates FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can create invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their account" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their account" ON public.invoices;

CREATE POLICY "Users can view invoices in their account"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create invoices in their account"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update invoices in their account"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete invoices in their account"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can create payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments in their account" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments in their account" ON public.payments;

CREATE POLICY "Users can view payments in their account"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create payments in their account"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update payments in their account"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete payments in their account"
  ON public.payments FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- MATERIAL_LISTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can create material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can update material lists in their account" ON public.material_lists;
DROP POLICY IF EXISTS "Users can delete material lists in their account" ON public.material_lists;

CREATE POLICY "Users can view material lists in their account"
  ON public.material_lists FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create material lists in their account"
  ON public.material_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update material lists in their account"
  ON public.material_lists FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete material lists in their account"
  ON public.material_lists FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- SUPPLY_ORDERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can create supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can update supply orders in their account" ON public.supply_orders;
DROP POLICY IF EXISTS "Users can delete supply orders in their account" ON public.supply_orders;

CREATE POLICY "Users can view supply orders in their account"
  ON public.supply_orders FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create supply orders in their account"
  ON public.supply_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update supply orders in their account"
  ON public.supply_orders FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete supply orders in their account"
  ON public.supply_orders FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- ESTIMATE_LINE_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can create estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can update estimate line items in their account" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users can delete estimate line items in their account" ON public.estimate_line_items;

CREATE POLICY "Users can view estimate line items in their account"
  ON public.estimate_line_items FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create estimate line items in their account"
  ON public.estimate_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update estimate line items in their account"
  ON public.estimate_line_items FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete estimate line items in their account"
  ON public.estimate_line_items FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- INVOICE_LINE_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can create invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can update invoice line items in their account" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can delete invoice line items in their account" ON public.invoice_line_items;

CREATE POLICY "Users can view invoice line items in their account"
  ON public.invoice_line_items FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create invoice line items in their account"
  ON public.invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update invoice line items in their account"
  ON public.invoice_line_items FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete invoice line items in their account"
  ON public.invoice_line_items FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- MATERIAL_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can create material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can update material items in their account" ON public.material_items;
DROP POLICY IF EXISTS "Users can delete material items in their account" ON public.material_items;

CREATE POLICY "Users can view material items in their account"
  ON public.material_items FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create material items in their account"
  ON public.material_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update material items in their account"
  ON public.material_items FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete material items in their account"
  ON public.material_items FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- SUPPLY_ORDER_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can create supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can update supply order items in their account" ON public.supply_order_items;
DROP POLICY IF EXISTS "Users can delete supply order items in their account" ON public.supply_order_items;

CREATE POLICY "Users can view supply order items in their account"
  ON public.supply_order_items FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create supply order items in their account"
  ON public.supply_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update supply order items in their account"
  ON public.supply_order_items FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete supply order items in their account"
  ON public.supply_order_items FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- INTERACTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can create interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can update interactions in their account" ON public.interactions;
DROP POLICY IF EXISTS "Users can delete interactions in their account" ON public.interactions;

CREATE POLICY "Users can view interactions in their account"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create interactions in their account"
  ON public.interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update interactions in their account"
  ON public.interactions FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete interactions in their account"
  ON public.interactions FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- LEAD_QUALIFICATIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can create lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can update lead qualifications in their account" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Users can delete lead qualifications in their account" ON public.lead_qualifications;

CREATE POLICY "Users can view lead qualifications in their account"
  ON public.lead_qualifications FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create lead qualifications in their account"
  ON public.lead_qualifications FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update lead qualifications in their account"
  ON public.lead_qualifications FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete lead qualifications in their account"
  ON public.lead_qualifications FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

-- ============================================================================
-- QUICK_ESTIMATES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can create quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can update quick estimates in their account" ON public.quick_estimates;
DROP POLICY IF EXISTS "Users can delete quick estimates in their account" ON public.quick_estimates;

CREATE POLICY "Users can view quick estimates in their account"
  ON public.quick_estimates FOR SELECT
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can create quick estimates in their account"
  ON public.quick_estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can update quick estimates in their account"
  ON public.quick_estimates FOR UPDATE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

CREATE POLICY "Users can delete quick estimates in their account"
  ON public.quick_estimates FOR DELETE
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
  );