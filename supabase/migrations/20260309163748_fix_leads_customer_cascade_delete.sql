/*\n  # Fix CASCADE DELETE for leads table customer_id\n\n  1. Changes\n    - Drop existing leads_customer_id_fkey constraint\n    - Recreate with ON DELETE CASCADE\n    - This allows customers to be deleted along with all their associated leads/jobs\n\n  2. Security\n    - Maintains referential integrity\n    - Existing RLS policies still apply\n*/\n\nALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey;
\n\nALTER TABLE leads \n  ADD CONSTRAINT leads_customer_id_fkey \n  FOREIGN KEY (customer_id) \n  REFERENCES customers(id) \n  ON DELETE CASCADE;
\n;
