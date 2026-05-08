/*\n  # Preserve invoices when customer is deleted\n\n  1. Changes\n    - Make customer_id nullable in invoices table\n    - Change foreign key constraint from ON DELETE CASCADE to ON DELETE SET NULL\n    - This ensures invoices are preserved when a customer is deleted\n  \n  2. Security\n    - No RLS changes needed\n*/\n\n-- First, make customer_id nullable\nALTER TABLE invoices \nALTER COLUMN customer_id DROP NOT NULL;
\n\n-- Drop the existing foreign key constraint\nALTER TABLE invoices \nDROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
\n\n-- Add the new foreign key constraint with SET NULL\nALTER TABLE invoices \nADD CONSTRAINT invoices_customer_id_fkey \nFOREIGN KEY (customer_id) \nREFERENCES customers(id) \nON DELETE SET NULL;
;
