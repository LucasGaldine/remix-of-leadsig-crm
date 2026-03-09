/*
  # Fix CASCADE DELETE for leads table customer_id

  1. Changes
    - Drop existing leads_customer_id_fkey constraint
    - Recreate with ON DELETE CASCADE
    - This allows customers to be deleted along with all their associated leads/jobs

  2. Security
    - Maintains referential integrity
    - Existing RLS policies still apply
*/

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey;

ALTER TABLE leads 
  ADD CONSTRAINT leads_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES customers(id) 
  ON DELETE CASCADE;
