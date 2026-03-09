/*
  # Preserve invoices and payments when customer is deleted

  ## Problem
  When deleting a customer:
  1. Payments CASCADE delete (lost accounting data)
  2. Leads CASCADE delete, which then CASCADE deletes invoices (lost invoices)
  
  ## Solution
  Change foreign key constraints to preserve financial/accounting records:
  - payments.customer_id: Change to SET NULL (preserve payments)
  - invoices.lead_id: Change to SET NULL (preserve invoices when leads are deleted)

  ## Changes
  1. Make payments.customer_id nullable
  2. Change payments_customer_id_fkey to ON DELETE SET NULL
  3. Change invoices_lead_id_fkey to ON DELETE SET NULL

  ## Important Notes
  - Payments and invoices are accounting/financial records that must be preserved
  - Even if customer or lead is deleted, the payment/invoice data remains for auditing
  - The records still maintain their amounts, dates, and payment information
*/

-- 1. Make payments.customer_id nullable
ALTER TABLE payments 
ALTER COLUMN customer_id DROP NOT NULL;

-- 2. Drop and recreate payments_customer_id_fkey with SET NULL
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;

ALTER TABLE payments 
ADD CONSTRAINT payments_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE SET NULL;

-- 3. Drop and recreate invoices_lead_id_fkey with SET NULL
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_lead_id_fkey;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_lead_id_fkey 
FOREIGN KEY (lead_id) 
REFERENCES leads(id) 
ON DELETE SET NULL;

-- 4. Drop and recreate payments_lead_id_fkey with SET NULL for consistency
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_lead_id_fkey;

ALTER TABLE payments 
ADD CONSTRAINT payments_lead_id_fkey 
FOREIGN KEY (lead_id) 
REFERENCES leads(id) 
ON DELETE SET NULL;

-- Update comments
COMMENT ON COLUMN payments.customer_id IS 'Reference to the customer. Can be NULL if customer was deleted (payment is preserved as historical record).';
COMMENT ON COLUMN invoices.lead_id IS 'Reference to the lead/job. Can be NULL if lead was deleted (invoice is preserved as historical record).';
COMMENT ON COLUMN payments.lead_id IS 'Reference to the lead/job. Can be NULL if lead was deleted (payment is preserved as historical record).';
