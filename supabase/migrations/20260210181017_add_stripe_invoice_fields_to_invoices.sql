/*
  # Add Stripe Invoice fields to invoices table

  1. Modified Tables
    - `invoices`
      - `stripe_invoice_id` (text) - Stripe Invoice ID for tracking
      - `stripe_invoice_url` (text) - Hosted Stripe Invoice URL for customer payment

  2. Important Notes
    - These columns allow linking a local invoice to a Stripe-hosted invoice
    - The URL is surfaced in the client portal so customers can pay online
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_url text;
  END IF;
END $$;
