/*
  # Fix Cascade Delete for Leads

  ## Problem
  When deleting a lead, related records in other tables are not being automatically
  deleted, causing foreign key constraint violations and orphaned data.

  ## Changes
  
  1. **customers table**
     - Change `lead_id` foreign key to SET NULL on delete
     - Customers should persist even if the lead is deleted
  
  2. **invoices table**
     - Change `lead_id` foreign key to CASCADE on delete
     - Invoices should be deleted when the lead is deleted
  
  3. **material_lists table**
     - Change `lead_id` foreign key to CASCADE on delete
     - Material lists should be deleted when the lead is deleted
  
  4. **payments table**
     - Change `lead_id` foreign key to CASCADE on delete
     - Payments should be deleted when the lead is deleted
  
  5. **supply_orders table**
     - Change `lead_id` foreign key to CASCADE on delete
     - Supply orders should be deleted when the lead is deleted

  ## Notes
  - The estimates table uses `job_id` (not `lead_id`) which already has CASCADE delete
  - We're keeping customers but removing the lead reference to preserve customer history
  - interactions and lead_qualifications already have CASCADE delete
  - quick_estimates already has CASCADE delete
*/

-- Fix customers.lead_id: SET NULL instead of CASCADE to preserve customer records
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_lead_id_fkey;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE SET NULL;

-- Fix invoices.lead_id: CASCADE delete
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_lead_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE CASCADE;

-- Fix material_lists.lead_id: CASCADE delete
ALTER TABLE public.material_lists
  DROP CONSTRAINT IF EXISTS material_lists_lead_id_fkey;

ALTER TABLE public.material_lists
  ADD CONSTRAINT material_lists_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE CASCADE;

-- Fix payments.lead_id: CASCADE delete
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_lead_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE CASCADE;

-- Fix supply_orders.lead_id: CASCADE delete
ALTER TABLE public.supply_orders
  DROP CONSTRAINT IF EXISTS supply_orders_lead_id_fkey;

ALTER TABLE public.supply_orders
  ADD CONSTRAINT supply_orders_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE CASCADE;