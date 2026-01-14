CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'owner',
    'admin',
    'sales',
    'crew_lead'
);


--
-- Name: disqualify_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disqualify_reason AS ENUM (
    'low_budget',
    'outside_area',
    'not_ready',
    'price_shopping',
    'ghosted',
    'other'
);


--
-- Name: estimate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estimate_status AS ENUM (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'expired'
);


--
-- Name: interaction_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_direction AS ENUM (
    'inbound',
    'outbound',
    'na'
);


--
-- Name: interaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_type AS ENUM (
    'call',
    'text',
    'note',
    'status_change',
    'booking',
    'system'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'viewed',
    'partial',
    'paid',
    'overdue'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'scheduled',
    'in-progress',
    'completed',
    'cancelled',
    'on-hold'
);


--
-- Name: lead_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_status AS ENUM (
    'new',
    'contacted',
    'qualified',
    'scheduled',
    'unqualified',
    'converted',
    'in_progress',
    'won',
    'lost'
);


--
-- Name: material_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_category AS ENUM (
    'base',
    'surface',
    'accessories',
    'fasteners',
    'other'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'draft',
    'ordered',
    'partial',
    'received',
    'cancelled'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'check',
    'card',
    'ach',
    'tap-to-pay',
    'other'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


--
-- Name: template_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.template_type AS ENUM (
    'pavers',
    'concrete',
    'sod',
    'decks',
    'fencing',
    'retaining-wall',
    'other'
);


--
-- Name: timeline_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.timeline_period AS ENUM (
    'asap',
    '1_2_weeks',
    '2_4_weeks',
    '1_3_months',
    '3_months_plus'
);


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'crew_lead' THEN 4
    END
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    name text DEFAULT 'Default API Key'::text NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estimate_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    estimate_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'each'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    job_id uuid,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0.08 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    status public.estimate_status DEFAULT 'draft'::public.estimate_status NOT NULL,
    expires_at date,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    accepted_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    type public.interaction_type DEFAULT 'note'::public.interaction_type NOT NULL,
    direction public.interaction_direction DEFAULT 'na'::public.interaction_direction NOT NULL,
    summary text,
    body text,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'each'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    job_id uuid,
    estimate_id uuid,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0.08 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    balance_due numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    due_date date,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    address text,
    service_type text,
    status public.job_status DEFAULT 'scheduled'::public.job_status NOT NULL,
    scheduled_date date,
    scheduled_time_start time without time zone,
    scheduled_time_end time without time zone,
    estimated_value numeric(12,2),
    actual_value numeric(12,2),
    crew_lead_id uuid,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_id uuid
);


--
-- Name: lead_qualifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_qualifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    budget_confirmed boolean DEFAULT false NOT NULL,
    service_area_fit boolean DEFAULT false NOT NULL,
    decision_maker_confirmed boolean DEFAULT false NOT NULL,
    timeline public.timeline_period,
    fit_score integer DEFAULT 0,
    disqualify_reason public.disqualify_reason,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_qualifications_fit_score_check CHECK (((fit_score >= 0) AND (fit_score <= 100)))
);


--
-- Name: lead_source_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_source_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    status text DEFAULT 'not_connected'::text NOT NULL,
    connected_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    settings_json jsonb DEFAULT '{}'::jsonb,
    api_key_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    inbound_email text,
    connection_method text DEFAULT 'webhook'::text,
    CONSTRAINT lead_source_connections_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'google'::text, 'angi'::text, 'yelp'::text, 'thumbtack'::text]))),
    CONSTRAINT lead_source_connections_status_check CHECK ((status = ANY (ARRAY['not_connected'::text, 'connected'::text, 'needs_attention'::text])))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    service_type text,
    estimated_budget numeric(12,2),
    source text,
    notes text,
    status public.lead_status DEFAULT 'new'::public.lead_status NOT NULL,
    qualification_score integer,
    assigned_to uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    external_source_id text,
    external_payload jsonb,
    approval_status text DEFAULT 'approved'::text NOT NULL,
    approval_reason text,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by_user_id uuid,
    rejected_at timestamp with time zone,
    rejected_by_user_id uuid,
    CONSTRAINT leads_approval_reason_check CHECK (((approval_reason IS NULL) OR (approval_reason = ANY (ARRAY['low_budget'::text, 'outside_service_area'::text, 'not_ready'::text, 'spam'::text, 'duplicate'::text, 'other'::text])))),
    CONSTRAINT leads_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT leads_qualification_score_check CHECK (((qualification_score >= 0) AND (qualification_score <= 100)))
);

ALTER TABLE ONLY public.leads REPLICA IDENTITY FULL;


--
-- Name: material_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_list_id uuid NOT NULL,
    name text NOT NULL,
    category public.material_category DEFAULT 'other'::public.material_category NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'each'::text NOT NULL,
    notes text,
    supplier_category text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    template_type public.template_type DEFAULT 'other'::public.template_type NOT NULL,
    measurements jsonb,
    wastage_factor integer DEFAULT 10 NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_lists_wastage_factor_check CHECK (((wastage_factor >= 0) AND (wastage_factor <= 50)))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    job_id uuid,
    amount numeric(12,2) NOT NULL,
    method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    transaction_ref text,
    receipt_url text,
    notes text,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_payment_intent_id text,
    stripe_account_id text
);


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    service_type text NOT NULL,
    base_labor_rate numeric DEFAULT 0 NOT NULL,
    material_rate numeric DEFAULT 0 NOT NULL,
    waste_factor numeric DEFAULT 10 NOT NULL,
    overhead_multiplier numeric DEFAULT 1.15 NOT NULL,
    profit_margin numeric DEFAULT 20 NOT NULL,
    unit_type text DEFAULT 'sq_ft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    email text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quick_estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    created_by uuid NOT NULL,
    service_type text NOT NULL,
    measurements jsonb DEFAULT '{}'::jsonb NOT NULL,
    labor_total numeric DEFAULT 0 NOT NULL,
    material_total numeric DEFAULT 0 NOT NULL,
    total_low numeric DEFAULT 0 NOT NULL,
    total_mid numeric DEFAULT 0 NOT NULL,
    total_high numeric DEFAULT 0 NOT NULL,
    notes text,
    converted_to_estimate_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stripe_connect_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_connect_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_account_id text NOT NULL,
    account_status text DEFAULT 'pending'::text NOT NULL,
    charges_enabled boolean DEFAULT false NOT NULL,
    payouts_enabled boolean DEFAULT false NOT NULL,
    details_submitted boolean DEFAULT false NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supply_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supply_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supply_order_id uuid NOT NULL,
    material_item_id uuid,
    name text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'each'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    received_qty numeric(10,2) DEFAULT 0,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supply_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supply_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_list_id uuid,
    job_id uuid,
    supplier_name text NOT NULL,
    order_number text,
    status public.order_status DEFAULT 'draft'::public.order_status NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    ordered_at timestamp with time zone,
    expected_delivery date,
    received_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    error_message text,
    invoice_id uuid,
    payment_id uuid
);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: estimate_line_items estimate_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_line_items
    ADD CONSTRAINT estimate_line_items_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: lead_qualifications lead_qualifications_lead_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_qualifications
    ADD CONSTRAINT lead_qualifications_lead_id_key UNIQUE (lead_id);


--
-- Name: lead_qualifications lead_qualifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_qualifications
    ADD CONSTRAINT lead_qualifications_pkey PRIMARY KEY (id);


--
-- Name: lead_source_connections lead_source_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_connections
    ADD CONSTRAINT lead_source_connections_pkey PRIMARY KEY (id);


--
-- Name: lead_source_connections lead_source_connections_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_connections
    ADD CONSTRAINT lead_source_connections_user_id_platform_key UNIQUE (user_id, platform);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: material_items material_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT material_items_pkey PRIMARY KEY (id);


--
-- Name: material_lists material_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_lists
    ADD CONSTRAINT material_lists_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_user_id_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_user_id_service_type_key UNIQUE (user_id, service_type);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: quick_estimates quick_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_estimates
    ADD CONSTRAINT quick_estimates_pkey PRIMARY KEY (id);


--
-- Name: stripe_connect_accounts stripe_connect_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_pkey PRIMARY KEY (id);


--
-- Name: stripe_connect_accounts stripe_connect_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_accounts_user_id_key UNIQUE (user_id);


--
-- Name: supply_order_items supply_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_order_items
    ADD CONSTRAINT supply_order_items_pkey PRIMARY KEY (id);


--
-- Name: supply_orders supply_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: webhook_events webhook_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_event_id_key UNIQUE (event_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: idx_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_user_id ON public.api_keys USING btree (user_id);


--
-- Name: idx_customers_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_created_by ON public.customers USING btree (created_by);


--
-- Name: idx_estimates_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_customer_id ON public.estimates USING btree (customer_id);


--
-- Name: idx_estimates_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_job_id ON public.estimates USING btree (job_id);


--
-- Name: idx_estimates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_status ON public.estimates USING btree (status);


--
-- Name: idx_interactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_created_at ON public.interactions USING btree (created_at DESC);


--
-- Name: idx_interactions_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_lead_id ON public.interactions USING btree (lead_id);


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);


--
-- Name: idx_invoices_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_job_id ON public.invoices USING btree (job_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_jobs_crew_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_crew_lead_id ON public.jobs USING btree (crew_lead_id);


--
-- Name: idx_jobs_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_customer_id ON public.jobs USING btree (customer_id);


--
-- Name: idx_jobs_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_lead_id ON public.jobs USING btree (lead_id);


--
-- Name: idx_jobs_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_scheduled_date ON public.jobs USING btree (scheduled_date);


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_status ON public.jobs USING btree (status);


--
-- Name: idx_lead_qualifications_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_qualifications_lead_id ON public.lead_qualifications USING btree (lead_id);


--
-- Name: idx_leads_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_approval_status ON public.leads USING btree (approval_status);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_material_items_material_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_items_material_list_id ON public.material_items USING btree (material_list_id);


--
-- Name: idx_material_lists_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_lists_job_id ON public.material_lists USING btree (job_id);


--
-- Name: idx_payments_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer_id ON public.payments USING btree (customer_id);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_supply_order_items_supply_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supply_order_items_supply_order_id ON public.supply_order_items USING btree (supply_order_id);


--
-- Name: idx_supply_orders_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supply_orders_job_id ON public.supply_orders USING btree (job_id);


--
-- Name: idx_supply_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supply_orders_status ON public.supply_orders USING btree (status);


--
-- Name: idx_webhook_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_event_type ON public.webhook_events USING btree (event_type);


--
-- Name: idx_webhook_events_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_processed_at ON public.webhook_events USING btree (processed_at DESC);


--
-- Name: idx_webhook_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_status ON public.webhook_events USING btree (status);


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: estimates update_estimates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: jobs update_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_qualifications update_lead_qualifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_qualifications_updated_at BEFORE UPDATE ON public.lead_qualifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_source_connections update_lead_source_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_source_connections_updated_at BEFORE UPDATE ON public.lead_source_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: material_lists update_material_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_material_lists_updated_at BEFORE UPDATE ON public.material_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pricing_rules update_pricing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quick_estimates update_quick_estimates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quick_estimates_updated_at BEFORE UPDATE ON public.quick_estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_connect_accounts update_stripe_connect_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stripe_connect_accounts_updated_at BEFORE UPDATE ON public.stripe_connect_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: supply_orders update_supply_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_supply_orders_updated_at BEFORE UPDATE ON public.supply_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: customers customers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: estimate_line_items estimate_line_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_line_items
    ADD CONSTRAINT estimate_line_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimates estimates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: estimates estimates_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: estimates estimates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: interactions interactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: interactions interactions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id);


--
-- Name: invoices invoices_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: jobs jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: jobs jobs_crew_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_crew_lead_id_fkey FOREIGN KEY (crew_lead_id) REFERENCES auth.users(id);


--
-- Name: jobs jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: jobs jobs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: lead_qualifications lead_qualifications_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_qualifications
    ADD CONSTRAINT lead_qualifications_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_source_connections lead_source_connections_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_connections
    ADD CONSTRAINT lead_source_connections_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: material_items material_items_material_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_items
    ADD CONSTRAINT material_items_material_list_id_fkey FOREIGN KEY (material_list_id) REFERENCES public.material_lists(id) ON DELETE CASCADE;


--
-- Name: material_lists material_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_lists
    ADD CONSTRAINT material_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: material_lists material_lists_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_lists
    ADD CONSTRAINT material_lists_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: payments payments_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quick_estimates quick_estimates_converted_to_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_estimates
    ADD CONSTRAINT quick_estimates_converted_to_estimate_id_fkey FOREIGN KEY (converted_to_estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL;


--
-- Name: quick_estimates quick_estimates_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_estimates
    ADD CONSTRAINT quick_estimates_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: supply_order_items supply_order_items_material_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_order_items
    ADD CONSTRAINT supply_order_items_material_item_id_fkey FOREIGN KEY (material_item_id) REFERENCES public.material_items(id);


--
-- Name: supply_order_items supply_order_items_supply_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_order_items
    ADD CONSTRAINT supply_order_items_supply_order_id_fkey FOREIGN KEY (supply_order_id) REFERENCES public.supply_orders(id) ON DELETE CASCADE;


--
-- Name: supply_orders supply_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: supply_orders supply_orders_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: supply_orders supply_orders_material_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_material_list_id_fkey FOREIGN KEY (material_list_id) REFERENCES public.material_lists(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webhook_events webhook_events_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: webhook_events webhook_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: jobs Crew leads can update assigned jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can update assigned jobs" ON public.jobs FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (crew_lead_id = auth.uid())));


--
-- Name: material_lists Crew leads can view and manage material lists for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view and manage material lists for their jobs" ON public.material_lists TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid()))))) WITH CHECK ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: supply_orders Crew leads can view and manage orders for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view and manage orders for their jobs" ON public.supply_orders TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid()))))) WITH CHECK ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: jobs Crew leads can view assigned jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view assigned jobs" ON public.jobs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (crew_lead_id = auth.uid())));


--
-- Name: leads Crew leads can view assigned leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view assigned leads" ON public.leads FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (assigned_to = auth.uid())));


--
-- Name: customers Crew leads can view customers for their assigned jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view customers for their assigned jobs" ON public.customers FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (id IN ( SELECT jobs.customer_id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: estimates Crew leads can view estimates for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view estimates for their jobs" ON public.estimates FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: interactions Crew leads can view interactions for assigned leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view interactions for assigned leads" ON public.interactions FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (lead_id IN ( SELECT leads.id
   FROM public.leads
  WHERE (leads.assigned_to = auth.uid())))));


--
-- Name: invoices Crew leads can view invoices for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view invoices for their jobs" ON public.invoices FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: lead_qualifications Crew leads can view lead_qualifications for assigned leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view lead_qualifications for assigned leads" ON public.lead_qualifications FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (lead_id IN ( SELECT leads.id
   FROM public.leads
  WHERE (leads.assigned_to = auth.uid())))));


--
-- Name: payments Crew leads can view payments for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view payments for their jobs" ON public.payments FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (job_id IN ( SELECT jobs.id
   FROM public.jobs
  WHERE (jobs.crew_lead_id = auth.uid())))));


--
-- Name: quick_estimates Crew leads can view quick_estimates for assigned leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crew leads can view quick_estimates for assigned leads" ON public.quick_estimates FOR SELECT USING ((public.has_role(auth.uid(), 'crew_lead'::public.app_role) AND (lead_id IN ( SELECT leads.id
   FROM public.leads
  WHERE (leads.assigned_to = auth.uid())))));


--
-- Name: material_items Items inherit material list access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Items inherit material list access" ON public.material_items TO authenticated USING ((material_list_id IN ( SELECT material_lists.id
   FROM public.material_lists))) WITH CHECK ((material_list_id IN ( SELECT material_lists.id
   FROM public.material_lists)));


--
-- Name: supply_order_items Items inherit supply order access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Items inherit supply order access" ON public.supply_order_items TO authenticated USING ((supply_order_id IN ( SELECT supply_orders.id
   FROM public.supply_orders))) WITH CHECK ((supply_order_id IN ( SELECT supply_orders.id
   FROM public.supply_orders)));


--
-- Name: estimate_line_items Line items inherit estimate access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Line items inherit estimate access" ON public.estimate_line_items TO authenticated USING ((estimate_id IN ( SELECT estimates.id
   FROM public.estimates))) WITH CHECK ((estimate_id IN ( SELECT estimates.id
   FROM public.estimates)));


--
-- Name: invoice_line_items Line items inherit invoice access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Line items inherit invoice access" ON public.invoice_line_items TO authenticated USING ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices))) WITH CHECK ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices)));


--
-- Name: profiles Owners and admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: webhook_events Owners and admins can view webhook events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can view webhook events" ON public.webhook_events FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: customers Owners and admins have full access to customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to customers" ON public.customers TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: estimates Owners and admins have full access to estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to estimates" ON public.estimates TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: interactions Owners and admins have full access to interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to interactions" ON public.interactions TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: invoices Owners and admins have full access to invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to invoices" ON public.invoices TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: jobs Owners and admins have full access to jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to jobs" ON public.jobs TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: lead_qualifications Owners and admins have full access to lead_qualifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to lead_qualifications" ON public.lead_qualifications TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: leads Owners and admins have full access to leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to leads" ON public.leads TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: material_lists Owners and admins have full access to material_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to material_lists" ON public.material_lists TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: payments Owners and admins have full access to payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to payments" ON public.payments TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: quick_estimates Owners and admins have full access to quick_estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to quick_estimates" ON public.quick_estimates USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: supply_orders Owners and admins have full access to supply_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins have full access to supply_orders" ON public.supply_orders TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Owners can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: leads Sales can create leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can create leads" ON public.leads FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'sales'::public.app_role) AND (auth.uid() = created_by)));


--
-- Name: leads Sales can update leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can update leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: leads Sales can view all leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view all leads" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: customers Sales can view and manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage customers" ON public.customers TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK ((public.has_role(auth.uid(), 'sales'::public.app_role) AND (auth.uid() = created_by)));


--
-- Name: estimates Sales can view and manage estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage estimates" ON public.estimates TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: interactions Sales can view and manage interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage interactions" ON public.interactions TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: invoices Sales can view and manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage invoices" ON public.invoices TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: jobs Sales can view and manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage jobs" ON public.jobs TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: lead_qualifications Sales can view and manage lead_qualifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage lead_qualifications" ON public.lead_qualifications TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: material_lists Sales can view and manage material_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage material_lists" ON public.material_lists TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: quick_estimates Sales can view and manage quick_estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage quick_estimates" ON public.quick_estimates USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: supply_orders Sales can view and manage supply_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and manage supply_orders" ON public.supply_orders TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: payments Sales can view and record payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales can view and record payments" ON public.payments TO authenticated USING (public.has_role(auth.uid(), 'sales'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'sales'::public.app_role));


--
-- Name: lead_source_connections Users can create their own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own connections" ON public.lead_source_connections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pricing_rules Users can create their own pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own pricing rules" ON public.pricing_rules FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: lead_source_connections Users can delete their own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own connections" ON public.lead_source_connections FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: pricing_rules Users can delete their own pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own pricing rules" ON public.pricing_rules FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: stripe_connect_accounts Users can insert their own Stripe account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own Stripe account" ON public.stripe_connect_accounts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: api_keys Users can manage their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own API keys" ON public.api_keys TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: stripe_connect_accounts Users can update their own Stripe account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own Stripe account" ON public.stripe_connect_accounts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: lead_source_connections Users can update their own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own connections" ON public.lead_source_connections FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pricing_rules Users can update their own pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own pricing rules" ON public.pricing_rules FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: stripe_connect_accounts Users can view their own Stripe account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own Stripe account" ON public.stripe_connect_accounts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: lead_source_connections Users can view their own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own connections" ON public.lead_source_connections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pricing_rules Users can view their own pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pricing rules" ON public.pricing_rules FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: estimate_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_qualifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_qualifications ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_source_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_source_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: material_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_items ENABLE ROW LEVEL SECURITY;

--
-- Name: material_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_connect_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: supply_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: supply_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




