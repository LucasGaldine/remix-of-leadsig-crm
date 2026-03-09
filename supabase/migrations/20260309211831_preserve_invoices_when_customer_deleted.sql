/*
  # Preserve invoices when customer is deleted

  1. Changes
    - Make customer_id nullable in invoices table
    - Change foreign key constraint from ON DELETE CASCADE to ON DELETE SET NULL
    - This ensures invoices are preserved when a customer is deleted
  
  2. Security
    - No RLS changes needed
*/

-- First, make customer_id nullable
ALTER TABLE invoices 
ALTER COLUMN customer_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;

-- Add the new foreign key constraint with SET NULL
ALTER TABLE invoices 
ADD CONSTRAINT invoices_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE SET NULL;