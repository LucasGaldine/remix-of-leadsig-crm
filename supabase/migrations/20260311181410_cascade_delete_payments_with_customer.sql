/*
  # Cascade delete payments when customer is deleted

  ## Changes
  This migration changes the behavior so that when a customer is deleted,
  all associated payments are also deleted (CASCADE) instead of being preserved.

  ## Modifications
  1. Update payments_customer_id_fkey to ON DELETE CASCADE
  2. Keep customer_id as nullable for flexibility with orphaned payments

  ## Security
  - No RLS policy changes needed
  - Data integrity maintained through cascade deletion
*/

-- Update payments_customer_id_fkey to CASCADE delete
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;

ALTER TABLE payments 
ADD CONSTRAINT payments_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE CASCADE;

-- Update comment to reflect cascade behavior
COMMENT ON COLUMN payments.customer_id IS 'Reference to the customer. Payments are deleted when the customer is deleted.';
