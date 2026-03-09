/*
  # Add Cascade Delete for Customer Relations

  1. Changes
    - Add CASCADE DELETE to foreign keys referencing customers table
    - This ensures that when a customer is deleted, all related data is automatically removed

  2. Tables Affected
    - leads (jobs) - CASCADE DELETE on customer_id
    - estimates - CASCADE DELETE on customer_id
    - invoices - CASCADE DELETE on customer_id
    - payments - CASCADE DELETE on customer_id

  3. Security
    - This maintains referential integrity and prevents orphaned records
    - Existing RLS policies still apply
*/

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_customer_id_fkey'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT jobs_customer_id_fkey;
    ALTER TABLE leads ADD CONSTRAINT jobs_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estimates_customer_id_fkey'
  ) THEN
    ALTER TABLE estimates DROP CONSTRAINT estimates_customer_id_fkey;
    ALTER TABLE estimates ADD CONSTRAINT estimates_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_customer_id_fkey'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_fkey;
    ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_customer_id_fkey'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_customer_id_fkey;
    ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;
