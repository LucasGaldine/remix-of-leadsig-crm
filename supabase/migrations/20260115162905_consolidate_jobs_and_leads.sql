/*
  # Consolidate Jobs and Leads into Single Unified Table
  
  ## Overview
  This migration merges the jobs and leads tables into a single unified table.
  Records will appear in either the "Leads" or "Jobs" view based on what fields are populated.
  
  ## Changes Made
  
  ### 1. Add Job Fields to Leads Table
  - `customer_id` - Reference to customers table (nullable for early-stage leads)
  - `scheduled_date` - When the job is scheduled
  - `scheduled_time_start` - Start time for the job
  - `scheduled_time_end` - End time for the job
  - `actual_value` - Final job value after completion
  - `crew_lead_id` - Assigned crew leader
  - `description` - Detailed job description (separate from notes)
  
  ### 2. Create Unified Status Enum
  - Combines lead_status and job_status into single enum
  - Covers full lifecycle: new → contacted → qualified → scheduled → in_progress → completed/won/lost
  
  ### 3. Data Migration
  - Migrate all existing jobs to leads table
  - Update foreign keys in related tables (estimates, invoices, material_lists, payments, supply_orders)
  
  ### 4. Update Foreign Keys and Indexes
  - Rename job_id to lead_id in all related tables
  - Update indexes for performance
  - Update RLS policies
  
  ### 5. Clean Up
  - Drop the jobs table
  - Remove old enums
*/

-- Step 1: Create unified status enum
DO $$ BEGIN
  CREATE TYPE public.unified_status AS ENUM (
    'new',
    'contacted',
    'qualified',
    'scheduled',
    'in_progress',
    'completed',
    'won',
    'lost',
    'cancelled',
    'on_hold',
    'unqualified'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add job-related fields to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time_start time without time zone,
  ADD COLUMN IF NOT EXISTS scheduled_time_end time without time zone,
  ADD COLUMN IF NOT EXISTS actual_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS crew_lead_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS description text;

-- Step 3: Add estimated_value column (rename from estimated_budget later)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estimated_value numeric(12,2);

-- Step 4: Copy estimated_budget to estimated_value
UPDATE public.leads SET estimated_value = estimated_budget WHERE estimated_value IS NULL;

-- Step 5: Add new_status column to hold unified status
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS new_status public.unified_status;

-- Step 6: Map old lead statuses to new unified status
UPDATE public.leads
SET new_status = CASE 
  WHEN status = 'new' THEN 'new'::public.unified_status
  WHEN status = 'contacted' THEN 'contacted'::public.unified_status
  WHEN status = 'qualified' THEN 'qualified'::public.unified_status
  WHEN status = 'scheduled' THEN 'scheduled'::public.unified_status
  WHEN status = 'in_progress' THEN 'in_progress'::public.unified_status
  WHEN status = 'won' THEN 'won'::public.unified_status
  WHEN status = 'lost' THEN 'lost'::public.unified_status
  WHEN status = 'unqualified' THEN 'unqualified'::public.unified_status
  WHEN status = 'converted' THEN 'scheduled'::public.unified_status
  ELSE 'new'::public.unified_status
END
WHERE new_status IS NULL;

-- Step 7: Migrate jobs to leads table
INSERT INTO public.leads (
  id,
  name,
  phone,
  address,
  service_type,
  estimated_value,
  source,
  notes,
  new_status,
  created_by,
  created_at,
  updated_at,
  customer_id,
  scheduled_date,
  scheduled_time_start,
  scheduled_time_end,
  actual_value,
  crew_lead_id,
  description,
  approval_status
)
SELECT 
  j.id,
  j.name,
  c.phone,
  j.address,
  j.service_type,
  j.estimated_value,
  'migrated_from_jobs' as source,
  j.notes,
  CASE 
    WHEN j.status = 'scheduled' THEN 'scheduled'::public.unified_status
    WHEN j.status = 'in-progress' THEN 'in_progress'::public.unified_status
    WHEN j.status = 'completed' THEN 'completed'::public.unified_status
    WHEN j.status = 'cancelled' THEN 'cancelled'::public.unified_status
    WHEN j.status = 'on-hold' THEN 'on_hold'::public.unified_status
    ELSE 'scheduled'::public.unified_status
  END as new_status,
  j.created_by,
  j.created_at,
  j.updated_at,
  j.customer_id,
  j.scheduled_date,
  j.scheduled_time_start,
  j.scheduled_time_end,
  j.actual_value,
  j.crew_lead_id,
  j.description,
  'approved'
FROM public.jobs j
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = j.id);

-- Step 8: Update foreign keys in related tables to point to leads
-- We'll rename job_id columns to lead_id

-- Estimates table
ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_job_id_fkey;

ALTER TABLE public.estimates
  RENAME COLUMN job_id TO lead_id;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- Invoices table
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_job_id_fkey;

ALTER TABLE public.invoices
  RENAME COLUMN job_id TO lead_id;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- Material lists table
ALTER TABLE public.material_lists
  DROP CONSTRAINT IF EXISTS material_lists_job_id_fkey;

ALTER TABLE public.material_lists
  RENAME COLUMN job_id TO lead_id;

ALTER TABLE public.material_lists
  ADD CONSTRAINT material_lists_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- Payments table
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_job_id_fkey;

ALTER TABLE public.payments
  RENAME COLUMN job_id TO lead_id;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- Supply orders table
ALTER TABLE public.supply_orders
  DROP CONSTRAINT IF EXISTS supply_orders_job_id_fkey;

ALTER TABLE public.supply_orders
  RENAME COLUMN job_id TO lead_id;

ALTER TABLE public.supply_orders
  ADD CONSTRAINT supply_orders_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads(id);

-- Step 9: Update indexes
DROP INDEX IF EXISTS public.idx_estimates_job_id;
CREATE INDEX IF NOT EXISTS idx_estimates_lead_id ON public.estimates(lead_id);

DROP INDEX IF EXISTS public.idx_invoices_job_id;
CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON public.invoices(lead_id);

DROP INDEX IF EXISTS public.idx_material_lists_job_id;
CREATE INDEX IF NOT EXISTS idx_material_lists_lead_id ON public.material_lists(lead_id);

DROP INDEX IF EXISTS public.idx_supply_orders_job_id;
CREATE INDEX IF NOT EXISTS idx_supply_orders_lead_id ON public.supply_orders(lead_id);

-- Add new indexes for job-related queries on leads
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_date ON public.leads(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_leads_crew_lead_id ON public.leads(crew_lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_new_status ON public.leads(new_status);

-- Step 10: Drop old status column and rename new_status
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS status;

ALTER TABLE public.leads
  RENAME COLUMN new_status TO status;

-- Set default and not null constraint
ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'new'::public.unified_status,
  ALTER COLUMN status SET NOT NULL;

-- Step 11: Drop old columns from leads
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS estimated_budget;

-- Step 12: Drop the jobs table
DROP TABLE IF EXISTS public.jobs CASCADE;

-- Step 13: Drop old enum types
DROP TYPE IF EXISTS public.job_status CASCADE;
DROP TYPE IF EXISTS public.lead_status CASCADE;

-- Step 14: Update RLS policies
-- Drop old job-related policies
DROP POLICY IF EXISTS "Users can view jobs they created" ON public.leads;
DROP POLICY IF EXISTS "Users can create jobs" ON public.leads;
DROP POLICY IF EXISTS "Users can update jobs they created" ON public.leads;
DROP POLICY IF EXISTS "Crew leads can view and update their assigned jobs" ON public.leads;

-- Create unified policies for leads (which now include jobs)
CREATE POLICY "Users can view their leads and jobs"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    crew_lead_id = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "Users can create leads and jobs"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their leads and jobs"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    crew_lead_id = auth.uid() OR
    assigned_to = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid() OR
    crew_lead_id = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "Users can delete their leads and jobs"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
