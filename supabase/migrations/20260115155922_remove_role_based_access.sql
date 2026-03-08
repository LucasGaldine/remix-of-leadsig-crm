/*
  # Remove Role-Based Access Control

  1. Changes
    - Drops all role-based RLS policies across all tables
    - Replaces with simple authenticated user access
    - All authenticated users can now access all data

  2. Tables Affected (22 total)
    - jobs, customers, profiles
    - leads, estimates, invoices, interactions, payments
    - material_lists, material_items
    - supply_orders, supply_order_items
    - estimate_line_items, invoice_line_items
    - lead_qualifications, quick_estimates
    - user_roles, api_keys, webhook_events
    - stripe_connect_accounts, lead_source_connections, pricing_rules

  3. Security
    - All tables remain protected by RLS
    - Only authenticated users can access data
    - No more role checks or created_by restrictions
*/

-- ============================================================================
-- DROP ALL EXISTING POLICIES
-- ============================================================================

-- User Roles Policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Jobs Policies
DROP POLICY IF EXISTS "Crew leads can update assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Crew leads can view assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Owners and admins have full access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Sales can view and manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view and manage jobs they created" ON public.jobs;

-- Customers Policies
DROP POLICY IF EXISTS "Crew leads can view customers for their assigned jobs" ON public.customers;
DROP POLICY IF EXISTS "Owners and admins have full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Sales can view and manage customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view and manage customers they created" ON public.customers;

-- Profiles Policies
DROP POLICY IF EXISTS "Owners and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Leads Policies
DROP POLICY IF EXISTS "Crew leads can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Owners and admins have full access to leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can create leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can update leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can view all leads" ON public.leads;

-- Estimates Policies
DROP POLICY IF EXISTS "Crew leads can view estimates for their jobs" ON public.estimates;
DROP POLICY IF EXISTS "Owners and admins have full access to estimates" ON public.estimates;
DROP POLICY IF EXISTS "Sales can view and manage estimates" ON public.estimates;

-- Invoices Policies
DROP POLICY IF EXISTS "Crew leads can view invoices for their jobs" ON public.invoices;
DROP POLICY IF EXISTS "Owners and admins have full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Sales can view and manage invoices" ON public.invoices;

-- Interactions Policies
DROP POLICY IF EXISTS "Crew leads can view interactions for assigned leads" ON public.interactions;
DROP POLICY IF EXISTS "Owners and admins have full access to interactions" ON public.interactions;
DROP POLICY IF EXISTS "Sales can view and manage interactions" ON public.interactions;

-- Payments Policies
DROP POLICY IF EXISTS "Crew leads can view payments for their jobs" ON public.payments;
DROP POLICY IF EXISTS "Owners and admins have full access to payments" ON public.payments;
DROP POLICY IF EXISTS "Sales can view and record payments" ON public.payments;

-- Material Lists Policies
DROP POLICY IF EXISTS "Crew leads can view and manage material lists for their jobs" ON public.material_lists;
DROP POLICY IF EXISTS "Owners and admins have full access to material_lists" ON public.material_lists;
DROP POLICY IF EXISTS "Sales can view and manage material_lists" ON public.material_lists;

-- Material Items Policies
DROP POLICY IF EXISTS "Items inherit material list access" ON public.material_items;

-- Supply Orders Policies
DROP POLICY IF EXISTS "Crew leads can view and manage orders for their jobs" ON public.supply_orders;
DROP POLICY IF EXISTS "Owners and admins have full access to supply_orders" ON public.supply_orders;
DROP POLICY IF EXISTS "Sales can view and manage supply_orders" ON public.supply_orders;

-- Supply Order Items Policies
DROP POLICY IF EXISTS "Items inherit supply order access" ON public.supply_order_items;

-- Estimate Line Items Policies
DROP POLICY IF EXISTS "Line items inherit estimate access" ON public.estimate_line_items;

-- Invoice Line Items Policies
DROP POLICY IF EXISTS "Line items inherit invoice access" ON public.invoice_line_items;

-- Lead Qualifications Policies
DROP POLICY IF EXISTS "Crew leads can view lead_qualifications for assigned leads" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Owners and admins have full access to lead_qualifications" ON public.lead_qualifications;
DROP POLICY IF EXISTS "Sales can view and manage lead_qualifications" ON public.lead_qualifications;

-- Quick Estimates Policies
DROP POLICY IF EXISTS "Crew leads can view quick_estimates for assigned leads" ON public.quick_estimates;
DROP POLICY IF EXISTS "Owners and admins have full access to quick_estimates" ON public.quick_estimates;
DROP POLICY IF EXISTS "Sales can view and manage quick_estimates" ON public.quick_estimates;

-- API Keys Policies
DROP POLICY IF EXISTS "Users can manage their own API keys" ON public.api_keys;

-- Webhook Events Policies
DROP POLICY IF EXISTS "Owners and admins can view webhook events" ON public.webhook_events;

-- Stripe Connect Accounts Policies
DROP POLICY IF EXISTS "Users can insert their own Stripe account" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Users can update their own Stripe account" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Users can view their own Stripe account" ON public.stripe_connect_accounts;

-- Lead Source Connections Policies
DROP POLICY IF EXISTS "Users can create their own connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON public.lead_source_connections;
DROP POLICY IF EXISTS "Users can view their own connections" ON public.lead_source_connections;

-- Pricing Rules Policies
DROP POLICY IF EXISTS "Users can create their own pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can update their own pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can delete their own pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Users can view their own pricing rules" ON public.pricing_rules;

-- ============================================================================
-- CREATE NEW SIMPLE POLICIES - AUTHENTICATED USERS HAVE FULL ACCESS
-- ============================================================================

-- Jobs Table
CREATE POLICY "Authenticated users have full access to jobs"
  ON public.jobs
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Customers Table
CREATE POLICY "Authenticated users have full access to customers"
  ON public.customers
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Profiles Table
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Leads Table
CREATE POLICY "Authenticated users have full access to leads"
  ON public.leads
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Estimates Table
CREATE POLICY "Authenticated users have full access to estimates"
  ON public.estimates
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoices Table
CREATE POLICY "Authenticated users have full access to invoices"
  ON public.invoices
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Interactions Table
CREATE POLICY "Authenticated users have full access to interactions"
  ON public.interactions
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payments Table
CREATE POLICY "Authenticated users have full access to payments"
  ON public.payments
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Material Lists Table
CREATE POLICY "Authenticated users have full access to material_lists"
  ON public.material_lists
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Material Items Table
CREATE POLICY "Authenticated users have full access to material_items"
  ON public.material_items
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Supply Orders Table
CREATE POLICY "Authenticated users have full access to supply_orders"
  ON public.supply_orders
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Supply Order Items Table
CREATE POLICY "Authenticated users have full access to supply_order_items"
  ON public.supply_order_items
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Estimate Line Items Table
CREATE POLICY "Authenticated users have full access to estimate_line_items"
  ON public.estimate_line_items
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoice Line Items Table
CREATE POLICY "Authenticated users have full access to invoice_line_items"
  ON public.invoice_line_items
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Lead Qualifications Table
CREATE POLICY "Authenticated users have full access to lead_qualifications"
  ON public.lead_qualifications
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Quick Estimates Table
CREATE POLICY "Authenticated users have full access to quick_estimates"
  ON public.quick_estimates
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- User Roles Table
CREATE POLICY "Authenticated users have full access to user_roles"
  ON public.user_roles
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- API Keys Table
CREATE POLICY "Authenticated users have full access to api_keys"
  ON public.api_keys
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Webhook Events Table
CREATE POLICY "Authenticated users have full access to webhook_events"
  ON public.webhook_events
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Stripe Connect Accounts Table
CREATE POLICY "Authenticated users have full access to stripe_connect_accounts"
  ON public.stripe_connect_accounts
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Lead Source Connections Table
CREATE POLICY "Authenticated users have full access to lead_source_connections"
  ON public.lead_source_connections
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Pricing Rules Table
CREATE POLICY "Authenticated users have full access to pricing_rules"
  ON public.pricing_rules
  TO authenticated
  USING (true)
  WITH CHECK (true);
