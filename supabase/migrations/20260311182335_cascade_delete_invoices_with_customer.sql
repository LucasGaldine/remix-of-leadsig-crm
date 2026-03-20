/*
  # Cascade delete invoices when customer is deleted

  ## Changes
  This migration changes the behavior so that when a customer is deleted,
  all associated invoices are also deleted (CASCADE) instead of being preserved.

  ## Modifications
  1. Update invoices_customer_id_fkey to ON DELETE CASCADE
  2. Keep customer_id as nullable for flexibility

  ## Security
  - No RLS policy changes needed
  - Data integrity maintained through cascade deletion
*/

-- Update invoices_customer_id_fkey to CASCADE delete
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE CASCADE;

-- Update comment to reflect cascade behavior
COMMENT ON COLUMN invoices.customer_id IS 'Reference to the customer. Invoices are deleted when the customer is deleted.';
